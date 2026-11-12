import { describe, it, expect, beforeEach } from 'vitest'
import { OrderService } from './order.service.js'
import { MockOrderRepository } from '@repositories/mocks/MockOrderRepository.js'
import { MockDiscountRepository } from '@repositories/mocks/MockDiscountRepository.js'
import type { Order } from '@models/order.model.js'
import {
    OrderNotFoundError,
    InvalidOrderStatusError,
    InvalidDiscountCodeError,
    DiscountNotFoundError,
    DiscountInactiveError,
    OrderDiscountAlreadyAppliedError,
    OrderAccessDeniedError
} from '@errors/DomainErrors.js'

describe('OrderService.updateItemStatus', () => {
    let repo: MockOrderRepository
    let service: OrderService
    let testOrder: Order

    beforeEach(async () => {
        repo = new MockOrderRepository()
        service = new OrderService(repo, new MockDiscountRepository())

        testOrder = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: null,
            createdAt: new Date(),
            discountCode: null,
            discountPercentage: null,
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' }
            ]
        }
        await repo.create(testOrder)
    })

    it('should update the status of an item successfully', async () => {
        await service.updateItemStatus('order-1', 'item-1', 'preparando')
        const updatedItem = testOrder.items[0]!
        expect(updatedItem.status).toBe('preparando')
    })

    it('should throw an error if the order does not exist', async () => {
        await expect(service.updateItemStatus('order-bad', 'item-1', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw an error if the item does not exist inside the order', async () => {
        await expect(service.updateItemStatus('order-1', 'item-bad', 'preparando'))
            .rejects.toThrow(OrderNotFoundError)
    })

    it('should throw DomainError if status is invalid', async () => {
        await expect(service.updateItemStatus('order-1', 'item-1', 'invalid-status'))
            .rejects.toThrow(InvalidOrderStatusError)
    })
})

describe('OrderService.create', () => {
    it('should create the order without discount', async () => {
        const service = new OrderService(new MockOrderRepository(), new MockDiscountRepository())
        const order = await service.create({ restaurantId: 'rest-1', tableId: null, clientId: 'c1', items: [{ dishId: 'd1', quantity: 2, notes: null }] })
        expect(order.discountCode).toBeNull()
        expect(order.discountPercentage).toBeNull()
        expect(order.items).toHaveLength(2)
    })
})

describe('OrderService discounts', () => {
    const NOW = '2026-11-12T10:00:00.000Z'
    const admin = { id: 'admin', role: 'admin' }
    const owner = { id: 'c1', role: 'cliente' }
    const otherClient = { id: 'c2', role: 'cliente' }

    let orderRepo: MockOrderRepository
    let discountRepo: MockDiscountRepository
    let service: OrderService
    let order: Order

    beforeEach(async () => {
        orderRepo = new MockOrderRepository()
        discountRepo = new MockDiscountRepository()
        service = new OrderService(orderRepo, discountRepo)

        order = {
            id: 'order-1',
            restaurantId: 'rest-1',
            tableId: null,
            clientId: 'c1',
            createdAt: new Date(),
            discountCode: null,
            discountPercentage: null,
            items: [
                { id: 'item-1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente', dishPrice: 8.5 },
                { id: 'item-2', dishId: 'dish-2', quantity: 1, notes: null, status: 'pendiente', dishPrice: 1.5 }
            ]
        }
        await orderRepo.create(order)
        await discountRepo.save({ id: 'd1', code: 'DISCOUNT30', percentage: 30, active: true, createdAt: NOW, updatedAt: NOW })
        await discountRepo.save({ id: 'd2', code: 'BLACK_FRIDAY', percentage: 50, active: true, createdAt: NOW, updatedAt: NOW })
        await discountRepo.save({ id: 'd3', code: 'OLD', percentage: 10, active: false, createdAt: NOW, updatedAt: NOW })
    })

    describe('applyDiscount', () => {
        it('should store a copy of the code and percentage in the order', async () => {
            const result = await service.applyDiscount('order-1', ' discount30 ', owner)

            expect(result).toMatchObject({ id: 'order-1', discountCode: 'DISCOUNT30', discountPercentage: 30 })
            expect((await orderRepo.findById('order-1'))?.discountPercentage).toBe(30)
        })

        it('should fix subtotal, discountAmount and total with the current prices', async () => {
            const result = await service.applyDiscount('order-1', 'DISCOUNT30', owner)

            expect(result).toMatchObject({ subtotal: 10, discountAmount: 3, total: 7 })
            expect(await orderRepo.findById('order-1')).toMatchObject({ subtotal: 10, discountAmount: 3, total: 7 })
        })

        it('should not recalculate the fixed amounts when the same code is applied again', async () => {
            await service.applyDiscount('order-1', 'DISCOUNT30', owner)
            order.items[0]!.dishPrice = 100

            const again = await service.applyDiscount('order-1', 'DISCOUNT30', owner)
            expect(again).toMatchObject({ subtotal: 10, discountAmount: 3, total: 7 })
        })

        it('should keep the fixed amounts when an item status changes', async () => {
            await service.applyDiscount('order-1', 'DISCOUNT30', owner)
            await service.updateItemStatus('order-1', 'item-1', 'preparando')
            expect(await orderRepo.findById('order-1')).toMatchObject({ discountCode: 'DISCOUNT30', total: 7 })
        })

        it('should be idempotent with the same code', async () => {
            await service.applyDiscount('order-1', 'DISCOUNT30', admin)
            const again = await service.applyDiscount('order-1', 'discount30', admin)
            expect(again.discountCode).toBe('DISCOUNT30')
        })

        it('should reject a different code when the order already has one', async () => {
            await service.applyDiscount('order-1', 'DISCOUNT30', admin)
            await expect(service.applyDiscount('order-1', 'BLACK_FRIDAY', admin)).rejects.toThrow(OrderDiscountAlreadyAppliedError)
        })

        it('should reject an invalid, unknown or inactive code', async () => {
            await expect(service.applyDiscount('order-1', '', admin)).rejects.toThrow(InvalidDiscountCodeError)
            await expect(service.applyDiscount('order-1', 'NOPE', admin)).rejects.toThrow(DiscountNotFoundError)
            await expect(service.applyDiscount('order-1', 'OLD', admin)).rejects.toThrow(DiscountInactiveError)
        })

        it('should throw OrderNotFoundError for an unknown order', async () => {
            await expect(service.applyDiscount('nope', 'DISCOUNT30', admin)).rejects.toThrow(OrderNotFoundError)
        })

        it('should forbid a client to apply a discount to an order of another client', async () => {
            await expect(service.applyDiscount('order-1', 'DISCOUNT30', otherClient)).rejects.toThrow(OrderAccessDeniedError)
        })

        it('should let employees apply discounts to any order', async () => {
            const result = await service.applyDiscount('order-1', 'DISCOUNT30', { id: 'w1', role: 'camarero' })
            expect(result.discountCode).toBe('DISCOUNT30')
        })
    })

    describe('removeDiscount', () => {
        it('should clear the discount and be idempotent', async () => {
            await service.applyDiscount('order-1', 'DISCOUNT30', owner)

            await service.removeDiscount('order-1', owner)
            await service.removeDiscount('order-1', owner)

            const stored = await orderRepo.findById('order-1')
            expect(stored?.discountCode).toBeNull()
            expect(stored?.discountPercentage).toBeNull()
            expect(stored?.total).toBeUndefined()
        })

        it('should throw OrderNotFoundError or OrderAccessDeniedError', async () => {
            await expect(service.removeDiscount('nope', admin)).rejects.toThrow(OrderNotFoundError)
            await expect(service.removeDiscount('order-1', otherClient)).rejects.toThrow(OrderAccessDeniedError)
        })
    })
})

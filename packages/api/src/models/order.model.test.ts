import { describe, it, expect } from 'vitest'
import { withOrderTotals, calculateOrderTotals } from './order.model.js'
import type { Order } from './order.model.js'

function buildOrder(prices: number[], discountPercentage: number | null): Order {
    return {
        id: 'o1',
        restaurantId: 'r1',
        tableId: null,
        clientId: null,
        createdAt: new Date(),
        discountCode: discountPercentage === null ? null : 'CODE',
        discountPercentage,
        items: prices.map((price, i) => ({
            id: `i${i}`,
            dishId: 'd1',
            quantity: 1,
            notes: null,
            status: 'pendiente' as const,
            dishPrice: price
        }))
    }
}

describe('withOrderTotals', () => {
    it('should compute subtotal and total without discount', () => {
        const order = withOrderTotals(buildOrder([8.5, 1.5], null))
        expect(order.subtotal).toBe(10)
        expect(order.discountAmount).toBe(0)
        expect(order.total).toBe(10)
    })

    it('should apply the discount percentage', () => {
        const order = withOrderTotals(buildOrder([8.5, 1.5], 30))
        expect(order.subtotal).toBe(10)
        expect(order.discountAmount).toBe(3)
        expect(order.total).toBe(7)
    })

    it('should round amounts to 2 decimals', () => {
        const order = withOrderTotals(buildOrder([9.99], 15))
        expect(order.discountAmount).toBe(1.5)
        expect(order.total).toBe(8.49)
    })

    it('should give a total of 0 with a 100% discount', () => {
        const order = withOrderTotals(buildOrder([12, 3.25], 100))
        expect(order.total).toBe(0)
    })

    it('should treat items without price as 0', () => {
        const order = buildOrder([5], null)
        delete order.items[0]!.dishPrice
        expect(withOrderTotals(order).subtotal).toBe(0)
    })

    it('should keep the amounts fixed when the order already has them', () => {
        const order = { ...buildOrder([20], 30), subtotal: 10, discountAmount: 3, total: 7 }
        expect(withOrderTotals(order)).toMatchObject({ subtotal: 10, discountAmount: 3, total: 7 })
    })

    it('should multiply by quantity', () => {
        const order = buildOrder([2.5], null)
        order.items[0]!.quantity = 3
        expect(withOrderTotals(order).subtotal).toBe(7.5)
    })
})

describe('calculateOrderTotals', () => {
    it('should compute the amounts for some items and a percentage', () => {
        const order = buildOrder([8.5, 1.5], null)
        expect(calculateOrderTotals(order.items, 30)).toEqual({ subtotal: 10, discountAmount: 3, total: 7 })
        expect(calculateOrderTotals(order.items, null)).toEqual({ subtotal: 10, discountAmount: 0, total: 10 })
    })
})

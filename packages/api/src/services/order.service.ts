import { randomUUID } from 'crypto'
import type { Order, OrderItem } from '@models/order.model.js'
import { normalizeOrderStatus, calculateOrderTotals } from '@models/order.model.js'
import type { OrderRepository } from '@repositories/order.repository.js'
import type { DiscountRepository } from '@repositories/discount.repository.js'
import { normalizeDiscountCode } from '@models/discount.model.js'
import {
    RestaurantIdRequiredError,
    OrderNotFoundError,
    OrderAccessDeniedError,
    DiscountNotFoundError,
    DiscountInactiveError,
    OrderDiscountAlreadyAppliedError
} from '@errors/DomainErrors.js'

export interface CreateOrderRequest {
    restaurantId: string
    tableId: string | null
    clientId: string | null
    items: {
        dishId: string
        quantity: number
        notes: string | null
    }[]
}

// Usuario autenticado que modifica el pedido (payload del JWT)
export interface OrderActor {
    id: string
    role: string
}

export class OrderService {
    constructor(
        private readonly orderRepository: OrderRepository,
        private readonly discountRepository: DiscountRepository
    ) {}

    async create(request: CreateOrderRequest): Promise<Order> {
        if (!request.restaurantId || request.restaurantId.trim() === '') {
            throw new RestaurantIdRequiredError()
        }

        const items: OrderItem[] = []
        for (const item of request.items) {
            for (let i = 0; i < item.quantity; i++) {
                items.push({
                    id: randomUUID(),
                    dishId: item.dishId,
                    quantity: 1,
                    notes: item.notes,
                    status: 'pendiente'
                })
            }
        }

        const order: Order = {
            id: randomUUID(),
            restaurantId: request.restaurantId,
            tableId: request.tableId,
            clientId: request.clientId,
            createdAt: new Date(),
            discountCode: null,
            discountPercentage: null,
            items
        }

        await this.orderRepository.create(order)

        return order
    }

    async listActive(restaurantId: string): Promise<Order[]> {
        return this.orderRepository.findActiveByRestaurant(restaurantId)
    }

    async getById(orderId: string): Promise<Order> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw new OrderNotFoundError()
        }
        return order
    }

    async getByClientId(clientId: string): Promise<Order[]> {
        return this.orderRepository.findByClientId(clientId)
    }

    async updateItemStatus(orderId: string, itemId: string, status: string): Promise<void> {
        const order = await this.orderRepository.findById(orderId)
        if (!order) {
            throw new OrderNotFoundError()
        }

        const item = order.items.find(i => i.id === itemId)
        if (!item) {
            throw new OrderNotFoundError() // Or ItemNotFoundError
        }

        const normalizedStatus = normalizeOrderStatus(status)
        item.status = normalizedStatus

        await this.orderRepository.updateItemStatus(orderId, itemId, normalizedStatus)
    }

    async applyDiscount(orderId: string, code: string, actor: OrderActor): Promise<Order> {
        const normalizedCode = normalizeDiscountCode(code)
        const order = await this.getModifiableOrder(orderId, actor)

        if (order.discountCode === normalizedCode) {
            return order
        }
        if (order.discountCode !== null) {
            throw new OrderDiscountAlreadyAppliedError()
        }

        const discount = await this.discountRepository.findByCode(normalizedCode)
        if (!discount) {
            throw new DiscountNotFoundError()
        }
        if (!discount.active) {
            throw new DiscountInactiveError()
        }

        // Los importes se fijan con los precios de este momento (dishPrice de los ítems)
        await this.orderRepository.updateDiscount(order.id, {
            code: discount.code,
            percentage: discount.percentage,
            ...calculateOrderTotals(order.items, discount.percentage)
        })
        return this.getById(order.id)
    }

    async removeDiscount(orderId: string, actor: OrderActor): Promise<void> {
        const order = await this.getModifiableOrder(orderId, actor)
        if (order.discountCode === null) {
            return
        }
        await this.orderRepository.updateDiscount(order.id, null)
    }

    // Un cliente solo puede modificar sus propios pedidos; los empleados, cualquiera
    private async getModifiableOrder(orderId: string, actor: OrderActor): Promise<Order> {
        const order = await this.getById(orderId)
        if (actor.role === 'cliente' && order.clientId !== actor.id) {
            throw new OrderAccessDeniedError()
        }
        return order
    }
}

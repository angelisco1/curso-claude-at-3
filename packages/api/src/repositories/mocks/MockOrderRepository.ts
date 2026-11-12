import type { OrderRepository } from '@repositories/order.repository.js'
import type { Order, OrderDiscountSnapshot } from '@models/order.model.js'

export class MockOrderRepository implements OrderRepository {
    orders: Order[] = []

    async create(order: Order): Promise<void> {
        this.orders.push(order)
    }

    async findById(id: string): Promise<Order | null> {
        return this.orders.find(o => o.id === id) || null
    }

    async updateItemStatus(_orderId: string, _itemId: string, _status: string): Promise<void> {
        // En un repositorio real esto es un UPDATE SQL. El mock no necesita
        // persistir nada porque el service ya muta el item en memoria
        // antes de llamar a este método.
    }

    async updateDiscount(orderId: string, discount: OrderDiscountSnapshot | null): Promise<void> {
        const order = this.orders.find(o => o.id === orderId)
        if (!order) return

        order.discountCode = discount?.code ?? null
        order.discountPercentage = discount?.percentage ?? null
        if (discount) {
            order.subtotal = discount.subtotal
            order.discountAmount = discount.discountAmount
            order.total = discount.total
        } else {
            delete order.subtotal
            delete order.discountAmount
            delete order.total
        }
    }

    async findActiveByRestaurant(restaurantId: string): Promise<Order[]> {
        return this.orders.filter(o => o.restaurantId === restaurantId)
    }

    async findByClientId(clientId: string): Promise<Order[]> {
        return this.orders.filter(o => o.clientId === clientId)
    }
}

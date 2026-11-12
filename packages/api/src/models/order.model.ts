import { InvalidOrderStatusError } from '@errors/DomainErrors.js'

const VALID_ORDER_STATUSES = ['pendiente', 'preparando', 'listo', 'entregado'] as const

export type OrderStatusType = typeof VALID_ORDER_STATUSES[number]

export interface OrderItem {
    id: string
    dishId: string
    quantity: number
    notes: string | null
    status: OrderStatusType
    dishName?: string
    dishPrice?: number
    dishCategory?: string
}

export interface Order {
    id: string
    restaurantId: string
    tableId: string | null
    clientId: string | null
    createdAt: Date
    discountCode: string | null
    discountPercentage: number | null
    items: OrderItem[]
    subtotal?: number
    discountAmount?: number
    total?: number
    restaurantName?: string
    restaurantLogoUrl?: string | null
}

export function normalizeOrderStatus(value: string): OrderStatusType {
    const normalized = value.toLowerCase().trim()
    if (!VALID_ORDER_STATUSES.includes(normalized as OrderStatusType)) {
        throw new InvalidOrderStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_ORDER_STATUSES.join(', ')}`)
    }
    return normalized as OrderStatusType
}

export function isOrderFullyDelivered(order: Order): boolean {
    return order.items.length > 0 && order.items.every(item => item.status === 'entregado')
}

function roundToCents(value: number): number {
    return Math.round(value * 100) / 100
}

export interface OrderTotals {
    subtotal: number
    discountAmount: number
    total: number
}

// Descuento aplicado a un pedido, con los importes fijados en el momento de aplicarlo
export interface OrderDiscountSnapshot extends OrderTotals {
    code: string
    percentage: number
}

export function calculateOrderTotals(items: OrderItem[], discountPercentage: number | null): OrderTotals {
    const subtotal = roundToCents(items.reduce((sum, item) => sum + (item.dishPrice ?? 0) * item.quantity, 0))
    const discountAmount = roundToCents(subtotal * (discountPercentage ?? 0) / 100)
    return { subtotal, discountAmount, total: roundToCents(subtotal - discountAmount) }
}

// Si el pedido ya trae importes fijados (al aplicar un descuento) se respetan; si no, se
// calculan con el precio actual de los platos (dishPrice)
export function withOrderTotals(order: Order): Order {
    if (order.subtotal !== undefined && order.discountAmount !== undefined && order.total !== undefined) {
        return order
    }
    return { ...order, ...calculateOrderTotals(order.items, order.discountPercentage) }
}

export interface OrderItem {
  id: string
  dishId: string
  quantity: number
  notes: string | null
  status: string
  dishName?: string
  dishPrice?: number
}

export interface Order {
  id: string
  restaurantId: string
  restaurantName?: string
  restaurantLogoUrl?: string | null
  tableId: string | null
  clientId: string | null
  createdAt: string
  discountCode?: string | null
  discountPercentage?: number | null
  /** Importes calculados por la API (no vienen en la respuesta de `POST /orders`). */
  subtotal?: number
  discountAmount?: number
  total?: number
  items: OrderItem[]
}

export interface CreateOrderItem {
  dishId: string
  quantity: number
  notes: string | null
}

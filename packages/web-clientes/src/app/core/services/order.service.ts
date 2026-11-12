import { Injectable, inject } from '@angular/core'
import { HttpClient, HttpErrorResponse } from '@angular/common/http'
import { Observable } from 'rxjs'
import { API_URL } from '@resttek/web-shared'
import { CreateOrderItem, Order } from '../models/order.model'

@Injectable({ providedIn: 'root' })
export class OrderService {
  private readonly http = inject(HttpClient)
  private readonly apiUrl = inject(API_URL)

  createOrder(restaurantId: string, tableId: string | null, items: CreateOrderItem[]): Observable<Order> {
    return this.http.post<Order>(`${this.apiUrl}/orders`, {
      restaurantId,
      tableId,
      items
    })
  }

  /** Aplica un código de descuento a un pedido existente; devuelve el pedido con los importes. */
  applyDiscount(orderId: string, code: string): Observable<Order> {
    return this.http.put<Order>(`${this.apiUrl}/orders/${orderId}/discount`, { code })
  }

  getMyOrders(): Observable<Order[]> {
    return this.http.get<Order[]>(`${this.apiUrl}/orders/mine`)
  }

  getOrderById(id: string): Observable<Order> {
    return this.http.get<Order>(`${this.apiUrl}/orders/${id}`)
  }
}

const DISCOUNT_ERROR_MESSAGES: Record<string, string> = {
  DiscountNotFoundError: 'El código de descuento no existe.',
  DiscountInactiveError: 'El código de descuento no está activo.',
  InvalidDiscountCodeError: 'El código de descuento no tiene un formato válido.',
  OrderDiscountAlreadyAppliedError: 'Este pedido ya tiene otro descuento aplicado.',
  OrderAccessDeniedError: 'No puedes aplicar descuentos a este pedido.'
}

/** Mensaje en español para un error de `PUT /orders/:id/discount`. */
export function discountErrorMessage(err: unknown): string {
  if (err instanceof HttpErrorResponse) {
    const name = typeof err.error?.error === 'string' ? err.error.error : ''
    if (DISCOUNT_ERROR_MESSAGES[name]) return DISCOUNT_ERROR_MESSAGES[name]
    if (err.status === 404) return DISCOUNT_ERROR_MESSAGES['DiscountNotFoundError']
    if (err.status === 409) return DISCOUNT_ERROR_MESSAGES['DiscountInactiveError']
    if (err.status === 400) return DISCOUNT_ERROR_MESSAGES['InvalidDiscountCodeError']
  }
  return 'No se pudo aplicar el código de descuento.'
}

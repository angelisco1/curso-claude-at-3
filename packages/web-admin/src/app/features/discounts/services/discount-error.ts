import { HttpErrorResponse } from '@angular/common/http'

const MESSAGES_BY_ERROR: Record<string, string> = {
  InvalidDiscountCodeError: 'El código debe tener entre 3 y 30 caracteres: letras, números, "_" o "-".',
  InvalidDiscountPercentageError: 'El porcentaje debe ser un entero entre 1 y 100.',
  InvalidDiscountActiveError: 'El valor de "activo" no es válido.',
  DuplicatedDiscountCodeError: 'Ya existe un descuento con ese código.',
  DiscountNotFoundError: 'El descuento no existe.'
}

/** Mensaje en español para un error de la API de descuentos (`{ error, message }`). */
export function discountErrorMessage(err: unknown, fallback: string): string {
  if (err instanceof HttpErrorResponse) {
    const name = typeof err.error?.error === 'string' ? err.error.error : null
    if (name && MESSAGES_BY_ERROR[name]) return MESSAGES_BY_ERROR[name]
    if (err.status === 409) return MESSAGES_BY_ERROR['DuplicatedDiscountCodeError']
    if (err.status === 403) return 'No tienes permisos para realizar esta acción.'
    if (err.status === 400) return typeof err.error?.message === 'string' ? err.error.message : 'Datos del descuento no válidos.'
  }
  return fallback
}

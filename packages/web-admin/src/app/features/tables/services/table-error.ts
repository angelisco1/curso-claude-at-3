import { HttpErrorResponse } from '@angular/common/http'

const MESSAGES_BY_ERROR: Record<string, string> = {
  InvalidTableNumberError: 'El número de mesa debe ser un entero mayor o igual que 1.',
  InvalidTableCapacityError: 'La capacidad debe ser un entero mayor o igual que 1.',
  DuplicatedTableNumberError: 'Ya existe una mesa con ese número en este restaurante.',
  TableOccupiedError: 'No se puede borrar una mesa ocupada.',
  TableNotFoundError: 'La mesa no existe.',
  RestaurantNotFoundError: 'El restaurante no existe.'
}

/** Nombre de error de dominio devuelto por la API (`{ error, message }`), o null. */
export function tableErrorName(err: unknown): string | null {
  if (err instanceof HttpErrorResponse && typeof err.error?.error === 'string') {
    return err.error.error
  }
  return null
}

/** Mensaje en español para el error de la API; se mapea por nombre, no por el texto de `message`. */
export function tableErrorMessage(err: unknown, fallback: string): string {
  const name = tableErrorName(err)
  if (name && MESSAGES_BY_ERROR[name]) return MESSAGES_BY_ERROR[name]
  if (err instanceof HttpErrorResponse && err.status === 403) {
    return 'No tienes permisos para realizar esta acción.'
  }
  return fallback
}

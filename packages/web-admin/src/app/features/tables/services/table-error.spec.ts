import { HttpErrorResponse } from '@angular/common/http'
import { tableErrorMessage, tableErrorName } from './table-error'

const apiError = (status: number, error: unknown) => new HttpErrorResponse({ status, error })

describe('tableErrorName', () => {
  it('devuelve el nombre del error de dominio de la API', () => {
    expect(tableErrorName(apiError(409, { error: 'DuplicatedTableNumberError', message: 'x' }))).toBe('DuplicatedTableNumberError')
  })

  it('devuelve null si no es un error HTTP con nombre', () => {
    expect(tableErrorName(new Error('x'))).toBeNull()
    expect(tableErrorName(apiError(500, null))).toBeNull()
  })
})

describe('tableErrorMessage', () => {
  it.each([
    ['DuplicatedTableNumberError', 'Ya existe una mesa con ese número en este restaurante.'],
    ['TableOccupiedError', 'No se puede borrar una mesa ocupada.'],
    ['InvalidTableNumberError', 'El número de mesa debe ser un entero mayor o igual que 1.'],
    ['InvalidTableCapacityError', 'La capacidad debe ser un entero mayor o igual que 1.'],
    ['TableNotFoundError', 'La mesa no existe.'],
    ['RestaurantNotFoundError', 'El restaurante no existe.'],
  ])('traduce %s', (name, message) => {
    expect(tableErrorMessage(apiError(400, { error: name, message: 'en' }), 'fb')).toBe(message)
  })

  it('403 sin nombre conocido muestra el mensaje de permisos', () => {
    expect(tableErrorMessage(apiError(403, { error: 'Forbidden: x' }), 'fb')).toBe('No tienes permisos para realizar esta acción.')
  })

  it('usa el fallback si el error es desconocido', () => {
    expect(tableErrorMessage(apiError(500, null), 'fb')).toBe('fb')
    expect(tableErrorMessage(null, 'fb')).toBe('fb')
  })
})

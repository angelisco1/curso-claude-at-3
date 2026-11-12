import { tableErrorMessage } from './table-errors'

describe('tableErrorMessage', () => {
  it.each([
    ['DuplicatedTableNumberError', 'Ya existe una mesa con ese número en este restaurante.'],
    ['TableOccupiedError', 'No se puede eliminar una mesa ocupada. Libérala primero.'],
    ['InvalidTableNumberError', 'El número de mesa debe ser un entero mayor o igual que 1.'],
    ['InvalidTableCapacityError', 'La capacidad debe ser un entero mayor o igual que 1.'],
    ['InvalidTableStatusError', 'El estado de la mesa no es válido.'],
    ['TableNotFoundError', 'La mesa no existe.'],
  ])('traduce %s', (name, msg) => {
    expect(tableErrorMessage({ status: 400, error: { error: name, message: 'en' } }, 'fb')).toBe(msg)
  })

  it('usa el fallback si el error es desconocido', () => {
    expect(tableErrorMessage({ status: 500 }, 'fb')).toBe('fb')
    expect(tableErrorMessage(null, 'fb')).toBe('fb')
  })

  it('usa message del servidor si el nombre es desconocido', () => {
    expect(tableErrorMessage({ error: { error: 'Otro', message: 'detalle' } }, 'fb')).toBe('detalle')
  })

  it('403 muestra mensaje de permisos', () => {
    expect(tableErrorMessage({ status: 403, error: { error: 'Forbidden: x' } }, 'fb')).toBe('No tienes permiso para realizar esta acción.')
  })
})

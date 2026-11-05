import type { CreateDishDto } from '../../models/dish.model'
import { validateDishForm } from './dish-form.validation'

const validForm = (overrides: Partial<CreateDishDto> = {}): CreateDishDto => ({
  name: 'Pizza',
  description: null,
  price: 10,
  category: 'principal',
  available: true,
  ingredients: [],
  ...overrides
})

describe('validateDishForm', () => {
  describe('nombre', () => {
    it('devuelve error con nombre vacío', () => {
      expect(validateDishForm(validForm({ name: '' })).name).toBe('El nombre es obligatorio')
    })

    it('devuelve error con nombre solo de espacios', () => {
      expect(validateDishForm(validForm({ name: '   ' })).name).toBe('El nombre es obligatorio')
    })

    it('no devuelve error con nombre válido', () => {
      expect(validateDishForm(validForm({ name: 'Pizza' })).name).toBeUndefined()
    })
  })
})

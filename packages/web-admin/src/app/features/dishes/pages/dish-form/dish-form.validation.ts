import type { CreateDishDto, DishIngredient } from '../../models/dish.model'

export type DishFormErrors = Partial<Record<'name' | 'price', string>>

export function validateDishForm(form: CreateDishDto): DishFormErrors {
  const errors: DishFormErrors = {}

  if (!form.name?.trim()) {
    errors.name = 'El nombre es obligatorio'
  }

  if (typeof form.price !== 'number' || Number.isNaN(form.price) || form.price <= 0) {
    errors.price = 'El precio debe ser mayor que 0'
  }

  return errors
}

export type NewIngredientErrors = Partial<Record<'ingredient' | 'quantity', string>>

export function validateNewIngredient(
  ingredientId: string,
  quantity: number,
  existing: DishIngredient[],
): NewIngredientErrors {
  const errors: NewIngredientErrors = {}

  if (!ingredientId) {
    errors.ingredient = 'Selecciona un ingrediente'
  } else if (existing.some((i) => i.ingredientId === ingredientId)) {
    errors.ingredient = 'Este ingrediente ya está en el plato'
  }

  if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity <= 0) {
    errors.quantity = 'La cantidad debe ser mayor que 0'
  }

  return errors
}

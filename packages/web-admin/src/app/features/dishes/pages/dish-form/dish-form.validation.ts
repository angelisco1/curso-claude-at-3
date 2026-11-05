import type { CreateDishDto } from '../../models/dish.model'

export type DishFormErrors = Partial<Record<'name' | 'price', string>>

export function validateDishForm(form: CreateDishDto): DishFormErrors {
  const errors: DishFormErrors = {}

  if (!form.name?.trim()) {
    errors.name = 'El nombre es obligatorio'
  }

  return errors
}

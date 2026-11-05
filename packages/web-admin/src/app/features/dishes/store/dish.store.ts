import { Injectable, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { DishService } from '../services/dish.service'
import type { Dish, CreateDishDto } from '../models/dish.model'

@Injectable({ providedIn: 'root' })
export class DishStore {
  private readonly service = inject(DishService)

  private readonly _dishes = signal<Dish[]>([])
  private readonly _loading = signal(false)
  private readonly _error = signal<string | null>(null)
  private _currentRestaurantId: string | null = null

  readonly dishes = this._dishes.asReadonly()
  readonly loading = this._loading.asReadonly()
  readonly error = this._error.asReadonly()

  async loadByRestaurant(restaurantId: string): Promise<void> {
    this._currentRestaurantId = restaurantId
    this._dishes.set([])
    this._loading.set(true)
    this._error.set(null)
    try {
      const data = await firstValueFrom(this.service.getAll(restaurantId))
      // Ignorar respuestas de un restaurante que ya no es el actual
      if (this._currentRestaurantId !== restaurantId) return
      this._dishes.set(data)
    } catch {
      if (this._currentRestaurantId !== restaurantId) return
      this._error.set('No se pudieron cargar los platos.')
    } finally {
      if (this._currentRestaurantId === restaurantId) this._loading.set(false)
    }
  }

  async create(restaurantId: string, dto: CreateDishDto): Promise<void> {
    const dish = await firstValueFrom(this.service.create(restaurantId, dto))
    this._dishes.update(list => [...list, dish])
  }

  async update(restaurantId: string, id: string, dto: CreateDishDto): Promise<void> {
    const updated = await firstValueFrom(this.service.update(restaurantId, id, dto))
    this._dishes.update(list => list.map(d => d.id === id ? updated : d))
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    await firstValueFrom(this.service.delete(restaurantId, id))
    this._dishes.update(list => list.filter(d => d.id !== id))
  }
}

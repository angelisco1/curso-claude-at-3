import { Injectable, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { TableService } from '../services/table.service'
import type { Table, CreateTableDto, UpdateTableDto } from '../models/table.model'

const byNumber = (a: Table, b: Table) => a.number - b.number

@Injectable({ providedIn: 'root' })
export class TableStore {
  private readonly service = inject(TableService)

  private readonly _tables = signal<Table[]>([])
  private readonly _loading = signal(false)
  private readonly _error = signal<string | null>(null)
  private _currentRestaurantId: string | null = null

  readonly tables = this._tables.asReadonly()
  readonly loading = this._loading.asReadonly()
  readonly error = this._error.asReadonly()

  async loadByRestaurant(restaurantId: string): Promise<void> {
    this._currentRestaurantId = restaurantId
    this._tables.set([])
    this._loading.set(true)
    this._error.set(null)
    try {
      const data = await firstValueFrom(this.service.getAll(restaurantId))
      // Ignorar respuestas de un restaurante que ya no es el actual
      if (this._currentRestaurantId !== restaurantId) return
      this._tables.set(data)
    } catch {
      if (this._currentRestaurantId !== restaurantId) return
      this._error.set('No se pudieron cargar las mesas.')
    } finally {
      if (this._currentRestaurantId === restaurantId) this._loading.set(false)
    }
  }

  async create(restaurantId: string, dto: CreateTableDto): Promise<void> {
    const table = await firstValueFrom(this.service.create(restaurantId, dto))
    this._tables.update(list => [...list, table].sort(byNumber))
  }

  async update(restaurantId: string, id: string, dto: UpdateTableDto): Promise<void> {
    const updated = await firstValueFrom(this.service.update(restaurantId, id, dto))
    this._tables.update(list => list.map(t => t.id === id ? updated : t).sort(byNumber))
  }

  async delete(restaurantId: string, id: string): Promise<void> {
    await firstValueFrom(this.service.delete(restaurantId, id))
    this._tables.update(list => list.filter(t => t.id !== id))
  }
}

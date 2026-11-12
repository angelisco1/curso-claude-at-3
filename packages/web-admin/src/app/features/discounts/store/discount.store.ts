import { Injectable, inject, signal } from '@angular/core'
import { firstValueFrom } from 'rxjs'
import { DiscountService } from '../services/discount.service'
import type { Discount, CreateDiscountDto, UpdateDiscountDto } from '../models/discount.model'

const byCode = (a: Discount, b: Discount) => a.code.localeCompare(b.code)

@Injectable({ providedIn: 'root' })
export class DiscountStore {
  private readonly service = inject(DiscountService)

  private readonly _discounts = signal<Discount[]>([])
  private readonly _loading = signal(false)
  private readonly _error = signal<string | null>(null)

  readonly discounts = this._discounts.asReadonly()
  readonly loading = this._loading.asReadonly()
  readonly error = this._error.asReadonly()

  async loadAll(): Promise<void> {
    this._loading.set(true)
    this._error.set(null)
    try {
      this._discounts.set(await firstValueFrom(this.service.getAll()))
    } catch {
      this._error.set('No se pudieron cargar los descuentos.')
    } finally {
      this._loading.set(false)
    }
  }

  async create(dto: CreateDiscountDto): Promise<void> {
    const created = await firstValueFrom(this.service.create(dto))
    this._discounts.update(list => [...list, created].sort(byCode))
  }

  async update(id: string, dto: UpdateDiscountDto): Promise<void> {
    const updated = await firstValueFrom(this.service.update(id, dto))
    this._discounts.update(list => list.map(d => d.id === id ? updated : d))
  }

  async delete(id: string): Promise<void> {
    await firstValueFrom(this.service.delete(id))
    this._discounts.update(list => list.filter(d => d.id !== id))
  }
}

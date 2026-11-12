import { Injectable, inject } from '@angular/core'
import { HttpClient } from '@angular/common/http'
import { environment } from '../../../../environments/environment'
import type { Discount, CreateDiscountDto, UpdateDiscountDto } from '../models/discount.model'

@Injectable({ providedIn: 'root' })
export class DiscountService {
  private readonly http = inject(HttpClient)
  private readonly baseUrl = `${environment.apiUrl}/discounts`

  getAll() {
    return this.http.get<Discount[]>(this.baseUrl)
  }

  create(dto: CreateDiscountDto) {
    return this.http.post<Discount>(this.baseUrl, dto)
  }

  update(id: string, dto: UpdateDiscountDto) {
    return this.http.patch<Discount>(`${this.baseUrl}/${id}`, dto)
  }

  delete(id: string) {
    return this.http.delete<void>(`${this.baseUrl}/${id}`)
  }
}

export interface Discount {
  id: string
  code: string
  percentage: number
  active: boolean
  createdAt: string
  updatedAt: string
}

export interface CreateDiscountDto {
  code: string
  percentage: number
}

export interface UpdateDiscountDto {
  percentage?: number
  active?: boolean
}

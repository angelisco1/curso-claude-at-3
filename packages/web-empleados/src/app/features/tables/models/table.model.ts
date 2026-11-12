export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  reservedForClientId: string | null
  reservedForEmail: string | null
  occupiedByClientId: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateTableStatusDto {
  status: TableStatus
  reservedForEmail?: string | null
}

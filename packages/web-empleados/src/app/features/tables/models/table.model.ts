export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export const TABLE_STATUSES: TableStatus[] = ['libre', 'ocupada', 'reservada']

export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  reservedFor: string | null
  createdAt: string
  updatedAt: string
}

export interface UpdateTableStatusDto {
  status: TableStatus
}

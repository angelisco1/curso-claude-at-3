export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export const TABLE_STATUSES: TableStatus[] = ['libre', 'ocupada', 'reservada']

export interface Table {
  id: string
  restaurantId: string
  number: number
  description: string | null
  capacity: number
  status: TableStatus
  /** Solo lectura: id del cliente titular de la reserva (null si no hay o es anónima). */
  reservedFor: string | null
  createdAt: string
  updatedAt: string
}

export interface CreateTableDto {
  number: number
  capacity: number
  description?: string | null
  status?: TableStatus
}

export interface UpdateTableDto {
  number: number
  capacity: number
  description?: string | null
  status?: TableStatus
}

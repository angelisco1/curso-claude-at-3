export type TableStatus = 'libre' | 'ocupada' | 'reservada'

export const TABLE_STATUS_LABELS: Record<TableStatus, string> = {
  libre: 'Libre',
  ocupada: 'Ocupada',
  reservada: 'Reservada'
}

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

export interface CreateTableDto {
  number: number
  capacity: number
  description: string | null
}

export interface UpdateTableDto {
  number: number
  capacity: number
  description: string | null
}

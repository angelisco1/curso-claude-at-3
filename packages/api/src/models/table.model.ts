import { InvalidTableStatusError } from '@errors/DomainErrors.js'

export const VALID_TABLE_STATUSES = ['libre', 'ocupada', 'reservada'] as const

export type TableStatusType = typeof VALID_TABLE_STATUSES[number]

export interface Table {
    id: string
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status: TableStatusType
    /** Id del cliente dueño de la reserva (solo con status `reservada`). */
    reservedFor: string | null
    /** Email del dueño de la reserva (se obtiene por JOIN con `employees`). */
    reservedForEmail: string | null
    /** Id del cliente que ocupó la mesa con `occupy` (solo con status `ocupada`). */
    occupiedBy: string | null
    createdAt: string
    updatedAt: string
}

export interface AvailableTable extends Table {
    reservedForMe: boolean
    occupiedByMe: boolean
}

export function normalizeTableStatus(value: string): TableStatusType {
    if (!value || typeof value !== 'string') {
        throw new InvalidTableStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_TABLE_STATUSES.join(', ')}`)
    }

    const normalized = value.trim().toLowerCase()
    if (!VALID_TABLE_STATUSES.includes(normalized as TableStatusType)) {
        throw new InvalidTableStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_TABLE_STATUSES.join(', ')}`)
    }
    return normalized as TableStatusType
}

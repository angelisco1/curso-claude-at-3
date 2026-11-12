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
    reservedFor: string | null
    createdAt: string
    updatedAt: string
}

export function normalizeTableStatus(value: string): TableStatusType {
    if (!value || typeof value !== 'string') {
        throw new InvalidTableStatusError('Table status must be provided')
    }

    const normalized = value.trim().toLowerCase()
    if (!VALID_TABLE_STATUSES.includes(normalized as TableStatusType)) {
        throw new InvalidTableStatusError(`Estado inválido: ${value}. Debe ser uno de: ${VALID_TABLE_STATUSES.join(', ')}`)
    }
    return normalized as TableStatusType
}

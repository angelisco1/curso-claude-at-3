import { randomUUID } from 'crypto'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    TableNotFoundError,
    TableOccupiedError
} from '@errors/DomainErrors.js'

export interface CreateTableDTO {
    number: number
    capacity: number
    description?: string | null | undefined
    status?: string | undefined
}

export type UpdateTableDTO = CreateTableDTO

export class TableService {
    constructor(private readonly tableRepository: TableRepository) {}

    async create(restaurantId: string, dto: CreateTableDTO): Promise<Table> {
        const now = new Date().toISOString()
        const table: Table = {
            id: randomUUID(),
            restaurantId,
            ...this.validateData(dto),
            status: dto.status === undefined ? 'libre' : normalizeTableStatus(dto.status),
            reservedFor: null,
            createdAt: now,
            updatedAt: now
        }

        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(restaurantId, id)
        const status: TableStatusType = dto.status === undefined ? existing.status : normalizeTableStatus(dto.status)

        const updated: Table = {
            ...existing,
            ...this.validateData(dto),
            status,
            reservedFor: status === existing.status ? existing.reservedFor : null,
            updatedAt: new Date().toISOString()
        }

        await this.tableRepository.save(updated)
        return updated
    }

    async delete(restaurantId: string, id: string): Promise<void> {
        const existing = await this.findById(restaurantId, id)
        if (existing.status === 'ocupada') {
            throw new TableOccupiedError()
        }
        await this.tableRepository.delete(id)
    }

    async findByRestaurant(restaurantId: string): Promise<Table[]> {
        return this.tableRepository.findByRestaurant(restaurantId)
    }

    async findById(restaurantId: string, id: string): Promise<Table> {
        const table = await this.tableRepository.findById(id)
        if (!table || table.restaurantId !== restaurantId) {
            throw new TableNotFoundError()
        }
        return table
    }

    private validateData(dto: CreateTableDTO): Pick<Table, 'number' | 'capacity' | 'description'> {
        if (!isPositiveInteger(dto.number)) {
            throw new InvalidTableNumberError()
        }
        if (!isPositiveInteger(dto.capacity)) {
            throw new InvalidTableCapacityError()
        }
        return {
            number: dto.number,
            capacity: dto.capacity,
            description: normalizeDescription(dto.description)
        }
    }
}

function isPositiveInteger(value: unknown): value is number {
    return typeof value === 'number' && Number.isInteger(value) && value >= 1
}

function normalizeDescription(value: unknown): string | null {
    if (typeof value !== 'string') return null
    const trimmed = value.trim()
    return trimmed === '' ? null : trimmed
}

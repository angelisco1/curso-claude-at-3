import { randomUUID } from 'crypto'
import type { AvailableTable, Table } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'
import type { TableRepository } from '@repositories/table.repository.js'
import type { RestaurantRepository } from '@repositories/restaurant.repository.js'
import {
    DuplicatedTableNumberError,
    InvalidPeopleCountError,
    InvalidReservationClientError,
    InvalidTableCapacityError,
    InvalidTableNumberError,
    RestaurantNotFoundError,
    TableNotAvailableError,
    TableNotFoundError,
    TableOccupiedError
} from '@errors/DomainErrors.js'

export interface CreateTableDTO {
    number: number
    description?: string | null
    capacity: number
}

export type UpdateTableDTO = CreateTableDTO

/** Búsqueda de usuarios por email (la implementa `SqliteEmployeeRepository`). */
export interface ClientFinder {
    findByEmail(email: string): Promise<{ id: string; role: string } | null>
}

export class TableService {
    constructor(
        private readonly tableRepository: TableRepository,
        private readonly restaurantRepository: RestaurantRepository,
        private readonly clientFinder: ClientFinder
    ) {}

    async create(restaurantId: string, dto: CreateTableDTO): Promise<Table> {
        const restaurant = await this.restaurantRepository.findById(restaurantId)
        if (!restaurant) {
            throw new RestaurantNotFoundError()
        }

        this.validateNumberAndCapacity(dto)
        await this.ensureNumberIsFree(restaurantId, dto.number)

        const now = new Date().toISOString()
        const table: Table = {
            id: randomUUID(),
            restaurantId,
            number: dto.number,
            description: this.normalizeDescription(dto.description),
            capacity: dto.capacity,
            status: 'libre',
            reservedFor: null,
            reservedForEmail: null,
            occupiedBy: null,
            createdAt: now,
            updatedAt: now
        }

        await this.tableRepository.save(table)
        return table
    }

    async update(restaurantId: string, id: string, dto: UpdateTableDTO): Promise<Table> {
        const existing = await this.findById(restaurantId, id)

        this.validateNumberAndCapacity(dto)
        await this.ensureNumberIsFree(restaurantId, dto.number, id)

        const updated: Table = {
            ...existing,
            number: dto.number,
            description: this.normalizeDescription(dto.description),
            capacity: dto.capacity,
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

    async findAvailable(restaurantId: string, people: number, userId: string): Promise<AvailableTable[]> {
        this.validatePeople(people)
        const tables = await this.tableRepository.findAvailable(restaurantId, people, userId)
        return tables.map(table => ({
            ...table,
            reservedForMe: table.status === 'reservada' && table.reservedFor === userId,
            occupiedByMe: table.status === 'ocupada' && table.occupiedBy === userId
        }))
    }

    async occupy(restaurantId: string, id: string, people: number, userId: string): Promise<Table> {
        this.validatePeople(people)

        const occupied = await this.tableRepository.occupyIfAvailable(id, restaurantId, people, userId, new Date().toISOString())
        // Si no se aplicó, findById distingue entre 404 (no existe / otro restaurante) y 409.
        const table = await this.findById(restaurantId, id)
        if (!occupied) {
            throw new TableNotAvailableError()
        }
        return table
    }

    async updateStatus(restaurantId: string, id: string, status: string, reservedForEmail?: string | null): Promise<Table> {
        await this.findById(restaurantId, id)
        const normalizedStatus = normalizeTableStatus(status)

        let reservedFor: string | null = null
        if (normalizedStatus === 'reservada' && typeof reservedForEmail === 'string' && reservedForEmail.trim() !== '') {
            const client = await this.clientFinder.findByEmail(reservedForEmail.trim().toLowerCase())
            if (!client || client.role !== 'cliente') {
                throw new InvalidReservationClientError()
            }
            reservedFor = client.id
        }

        await this.tableRepository.updateStatus(id, normalizedStatus, reservedFor, new Date().toISOString())
        return this.findById(restaurantId, id)
    }

    private validateNumberAndCapacity(dto: { number: unknown; capacity: unknown }): void {
        if (!this.isPositiveInteger(dto.number)) {
            throw new InvalidTableNumberError()
        }
        if (!this.isPositiveInteger(dto.capacity)) {
            throw new InvalidTableCapacityError()
        }
    }

    private validatePeople(people: unknown): void {
        if (!this.isPositiveInteger(people)) {
            throw new InvalidPeopleCountError()
        }
    }

    private isPositiveInteger(value: unknown): value is number {
        return typeof value === 'number' && Number.isInteger(value) && value >= 1
    }

    private async ensureNumberIsFree(restaurantId: string, number: number, currentId?: string): Promise<void> {
        const withSameNumber = await this.tableRepository.findByNumber(restaurantId, number)
        if (withSameNumber && withSameNumber.id !== currentId) {
            throw new DuplicatedTableNumberError()
        }
    }

    private normalizeDescription(description: string | null | undefined): string | null {
        if (typeof description !== 'string') return null
        const trimmed = description.trim()
        return trimmed === '' ? null : trimmed
    }
}

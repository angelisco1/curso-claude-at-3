import type { TableRepository } from '@repositories/table.repository.js'
import type { Table, TableStatusType } from '@models/table.model.js'

/**
 * Repositorio en memoria que reproduce la semántica de `SqliteTableRepository`
 * (incluido el UNIQUE(restaurant_id, number) y el UPDATE condicional de ocupación).
 * `clientEmails` simula el JOIN con `employees` para `reservedForEmail`.
 */
export class MockTableRepository implements TableRepository {
    private tables: Map<string, Table> = new Map()

    constructor(private readonly clientEmails: Record<string, string> = {}) {}

    async findById(id: string): Promise<Table | null> {
        const table = this.tables.get(id)
        return table ? { ...table } : null
    }

    async findByRestaurant(restaurantId: string): Promise<Table[]> {
        return Array.from(this.tables.values())
            .filter(t => t.restaurantId === restaurantId)
            .sort((a, b) => a.number - b.number)
            .map(t => ({ ...t }))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const table = Array.from(this.tables.values())
            .find(t => t.restaurantId === restaurantId && t.number === number)
        return table ? { ...table } : null
    }

    async findAvailable(restaurantId: string, people: number, userId: string): Promise<Table[]> {
        return Array.from(this.tables.values())
            .filter(t => t.restaurantId === restaurantId && t.capacity >= people && this.isAvailableFor(t, userId))
            .sort((a, b) => a.capacity - b.capacity || a.number - b.number)
            .map(t => ({ ...t }))
    }

    async save(table: Table): Promise<void> {
        const duplicated = Array.from(this.tables.values())
            .find(t => t.id !== table.id && t.restaurantId === table.restaurantId && t.number === table.number)
        if (duplicated) {
            throw new Error('SQLITE_CONSTRAINT: UNIQUE constraint failed: tables.restaurant_id, tables.number')
        }

        const existing = this.tables.get(table.id)
        if (existing) {
            this.tables.set(table.id, {
                ...existing,
                number: table.number,
                description: table.description,
                capacity: table.capacity,
                updatedAt: table.updatedAt
            })
        } else {
            this.tables.set(table.id, { ...table })
        }
    }

    async delete(id: string): Promise<void> {
        this.tables.delete(id)
    }

    async updateStatus(id: string, status: TableStatusType, reservedFor: string | null, updatedAt: string): Promise<void> {
        const table = this.tables.get(id)
        if (!table) return
        this.tables.set(id, {
            ...table,
            status,
            reservedFor,
            reservedForEmail: reservedFor ? (this.clientEmails[reservedFor] ?? null) : null,
            occupiedBy: null,
            updatedAt
        })
    }

    async occupyIfAvailable(id: string, restaurantId: string, people: number, userId: string, updatedAt: string): Promise<boolean> {
        const table = this.tables.get(id)
        if (!table || table.restaurantId !== restaurantId || table.capacity < people || !this.isAvailableFor(table, userId)) {
            return false
        }
        this.tables.set(id, {
            ...table,
            status: 'ocupada',
            occupiedBy: userId,
            reservedFor: null,
            reservedForEmail: null,
            updatedAt
        })
        return true
    }

    private isAvailableFor(table: Table, userId: string): boolean {
        return table.status === 'libre'
            || (table.status === 'reservada' && table.reservedFor === userId)
            || (table.status === 'ocupada' && table.occupiedBy === userId)
    }
}

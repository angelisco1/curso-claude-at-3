import type { TableRepository } from '@repositories/table.repository.js'
import type { Table, TableStatusType } from '@models/table.model.js'
import { DuplicatedTableNumberError } from '@errors/DomainErrors.js'

export class MockTableRepository implements TableRepository {
    private tables: Map<string, Table> = new Map()

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

    async save(table: Table): Promise<void> {
        const duplicated = Array.from(this.tables.values()).some(t =>
            t.id !== table.id && t.restaurantId === table.restaurantId && t.number === table.number
        )
        if (duplicated) {
            throw new DuplicatedTableNumberError()
        }
        this.tables.set(table.id, { ...table })
    }

    async delete(id: string): Promise<void> {
        this.tables.delete(id)
    }

    async findAvailable(restaurantId: string, people: number, userId: string): Promise<Table[]> {
        return Array.from(this.tables.values())
            .filter(t => t.restaurantId === restaurantId && this.isAvailableFor(t, people, userId))
            .sort((a, b) => a.capacity - b.capacity || a.number - b.number)
            .map(t => ({ ...t }))
    }

    async updateStatus(id: string, status: TableStatusType, reservedFor: string | null, updatedAt: string): Promise<void> {
        const table = this.tables.get(id)
        if (table) {
            this.tables.set(id, { ...table, status, reservedFor, updatedAt })
        }
    }

    async occupyIfAvailable(id: string, restaurantId: string, people: number, userId: string, updatedAt: string): Promise<boolean> {
        const table = this.tables.get(id)
        if (!table || table.restaurantId !== restaurantId || !this.isAvailableFor(table, people, userId)) {
            return false
        }
        this.tables.set(id, { ...table, status: 'ocupada', reservedFor: null, updatedAt })
        return true
    }

    private isAvailableFor(table: Table, people: number, userId: string): boolean {
        const status = table.status === 'libre' || (table.status === 'reservada' && table.reservedFor === userId)
        return status && table.capacity >= people
    }
}

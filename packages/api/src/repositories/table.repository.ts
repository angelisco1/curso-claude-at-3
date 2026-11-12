import { Database } from '@config/database.js'
import type { Table, TableStatusType } from '@models/table.model.js'
import { normalizeTableStatus } from '@models/table.model.js'

interface TableRow {
    id: string
    restaurantId: string
    number: number
    description: string | null
    capacity: number
    status: string
    reservedFor: string | null
    createdAt: string
    updatedAt: string
}

const SELECT_COLUMNS = 'id, restaurant_id as restaurantId, number, description, capacity, status, reserved_for as reservedFor, created_at as createdAt, updated_at as updatedAt'

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurant(restaurantId: string): Promise<Table[]>
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
    findAvailable(restaurantId: string, people: number, userId: string): Promise<Table[]>
    updateStatus(id: string, status: TableStatusType, reservedFor: string | null, updatedAt: string): Promise<void>
    occupyIfAvailable(id: string, restaurantId: string, people: number, userId: string, updatedAt: string): Promise<boolean>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`SELECT ${SELECT_COLUMNS} FROM tables WHERE id = ?`, [id])
        if (!row) return null
        return this.mapToTable(row)
    }

    async findByRestaurant(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `SELECT ${SELECT_COLUMNS} FROM tables WHERE restaurant_id = ? ORDER BY number`,
            [restaurantId]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async save(table: Table): Promise<void> {
        const existing = await this.findById(table.id)
        if (existing) {
            await this.db.run(
                'UPDATE tables SET number = ?, description = ?, capacity = ?, status = ?, reserved_for = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.status, table.reservedFor, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO tables (id, restaurant_id, number, description, capacity, status, reserved_for, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [table.id, table.restaurantId, table.number, table.description, table.capacity, table.status, table.reservedFor, table.createdAt, table.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM tables WHERE id = ?', [id])
    }

    async findAvailable(restaurantId: string, people: number, userId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `SELECT ${SELECT_COLUMNS} FROM tables
             WHERE restaurant_id = ? AND capacity >= ?
               AND (status = 'libre' OR (status = 'reservada' AND reserved_for = ?))
             ORDER BY capacity, number`,
            [restaurantId, people, userId]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async updateStatus(id: string, status: TableStatusType, reservedFor: string | null, updatedAt: string): Promise<void> {
        await this.db.run(
            'UPDATE tables SET status = ?, reserved_for = ?, updated_at = ? WHERE id = ?',
            [status, reservedFor, updatedAt, id]
        )
    }

    async occupyIfAvailable(id: string, restaurantId: string, people: number, userId: string, updatedAt: string): Promise<boolean> {
        const result = await this.db.run(
            `UPDATE tables SET status = 'ocupada', reserved_for = NULL, updated_at = ?
             WHERE id = ? AND restaurant_id = ? AND capacity >= ?
               AND (status = 'libre' OR (status = 'reservada' AND reserved_for = ?))`,
            [updatedAt, id, restaurantId, people, userId]
        )
        return result.changes === 1
    }

    private mapToTable(row: TableRow): Table {
        return {
            id: row.id,
            restaurantId: row.restaurantId,
            number: row.number,
            description: row.description,
            capacity: row.capacity,
            status: normalizeTableStatus(row.status),
            reservedFor: row.reservedFor,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}

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
    reservedForEmail: string | null
    occupiedBy: string | null
    createdAt: string
    updatedAt: string
}

const SELECT_TABLE = `
    SELECT t.id, t.restaurant_id as restaurantId, t.number, t.description, t.capacity, t.status,
           t.reserved_for as reservedFor, e.email as reservedForEmail, t.occupied_by as occupiedBy,
           t.created_at as createdAt, t.updated_at as updatedAt
    FROM tables t
    LEFT JOIN employees e ON e.id = t.reserved_for
`

export interface TableRepository {
    findById(id: string): Promise<Table | null>
    findByRestaurant(restaurantId: string): Promise<Table[]>
    findByNumber(restaurantId: string, number: number): Promise<Table | null>
    /** Mesas libres, reservadas para `userId` u ocupadas por `userId`, con `capacity >= people`. */
    findAvailable(restaurantId: string, people: number, userId: string): Promise<Table[]>
    /** Inserta o actualiza `number`, `description`, `capacity` y `updatedAt` (no toca el estado). */
    save(table: Table): Promise<void>
    delete(id: string): Promise<void>
    /** Cambia el estado, fija el dueño de la reserva y limpia siempre el ocupante. */
    updateStatus(id: string, status: TableStatusType, reservedFor: string | null, updatedAt: string): Promise<void>
    /** Ocupa la mesa en un único UPDATE condicional; devuelve `true` si se aplicó. */
    occupyIfAvailable(id: string, restaurantId: string, people: number, userId: string, updatedAt: string): Promise<boolean>
}

export class SqliteTableRepository implements TableRepository {
    constructor(private db: Database) {}

    async findById(id: string): Promise<Table | null> {
        const row = await this.db.get<TableRow>(`${SELECT_TABLE} WHERE t.id = ?`, [id])
        if (!row) return null
        return this.mapToTable(row)
    }

    async findByRestaurant(restaurantId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `${SELECT_TABLE} WHERE t.restaurant_id = ? ORDER BY t.number`,
            [restaurantId]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async findByNumber(restaurantId: string, number: number): Promise<Table | null> {
        const row = await this.db.get<TableRow>(
            `${SELECT_TABLE} WHERE t.restaurant_id = ? AND t.number = ?`,
            [restaurantId, number]
        )
        if (!row) return null
        return this.mapToTable(row)
    }

    async findAvailable(restaurantId: string, people: number, userId: string): Promise<Table[]> {
        const rows = await this.db.all<TableRow>(
            `${SELECT_TABLE}
             WHERE t.restaurant_id = ? AND t.capacity >= ?
               AND (t.status = 'libre'
                    OR (t.status = 'reservada' AND t.reserved_for = ?)
                    OR (t.status = 'ocupada' AND t.occupied_by = ?))
             ORDER BY t.capacity, t.number`,
            [restaurantId, people, userId, userId]
        )
        return rows.map(row => this.mapToTable(row))
    }

    async save(table: Table): Promise<void> {
        const existing = await this.findById(table.id)
        if (existing) {
            await this.db.run(
                'UPDATE tables SET number = ?, description = ?, capacity = ?, updated_at = ? WHERE id = ?',
                [table.number, table.description, table.capacity, table.updatedAt, table.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO tables (id, restaurant_id, number, description, capacity, status, reserved_for, occupied_by, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [table.id, table.restaurantId, table.number, table.description, table.capacity, table.status, table.reservedFor, table.occupiedBy, table.createdAt, table.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM tables WHERE id = ?', [id])
    }

    async updateStatus(id: string, status: TableStatusType, reservedFor: string | null, updatedAt: string): Promise<void> {
        await this.db.run(
            'UPDATE tables SET status = ?, reserved_for = ?, occupied_by = NULL, updated_at = ? WHERE id = ?',
            [status, reservedFor, updatedAt, id]
        )
    }

    async occupyIfAvailable(id: string, restaurantId: string, people: number, userId: string, updatedAt: string): Promise<boolean> {
        const result = await this.db.run(
            `UPDATE tables
             SET status = 'ocupada', occupied_by = ?, reserved_for = NULL, updated_at = ?
             WHERE id = ? AND restaurant_id = ? AND capacity >= ?
               AND (status = 'libre'
                    OR (status = 'reservada' AND reserved_for = ?)
                    OR (status = 'ocupada' AND occupied_by = ?))`,
            [userId, updatedAt, id, restaurantId, people, userId, userId]
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
            reservedForEmail: row.reservedFor ? row.reservedForEmail : null,
            occupiedBy: row.occupiedBy,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}

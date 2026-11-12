import { Database } from '@config/database.js'
import type { Discount } from '@models/discount.model.js'

interface DiscountRow {
    id: string
    code: string
    percentage: number
    active: number
    createdAt: string
    updatedAt: string
}

export interface DiscountFilter {
    active?: boolean
}

export interface DiscountRepository {
    findById(id: string): Promise<Discount | null>
    findByCode(code: string): Promise<Discount | null>
    findAll(filter?: DiscountFilter): Promise<Discount[]>
    save(discount: Discount): Promise<void>
    delete(id: string): Promise<void>
}

const SELECT_DISCOUNT = 'SELECT id, code, percentage, active, created_at as createdAt, updated_at as updatedAt FROM discounts'

export class SqliteDiscountRepository implements DiscountRepository {
    constructor(private readonly db: Database) {}

    async findById(id: string): Promise<Discount | null> {
        const row = await this.db.get<DiscountRow>(`${SELECT_DISCOUNT} WHERE id = ?`, [id])
        return row ? this.mapToDiscount(row) : null
    }

    async findByCode(code: string): Promise<Discount | null> {
        const row = await this.db.get<DiscountRow>(`${SELECT_DISCOUNT} WHERE code = ?`, [code])
        return row ? this.mapToDiscount(row) : null
    }

    async findAll(filter: DiscountFilter = {}): Promise<Discount[]> {
        const rows = filter.active === undefined
            ? await this.db.all<DiscountRow>(`${SELECT_DISCOUNT} ORDER BY code ASC`)
            : await this.db.all<DiscountRow>(`${SELECT_DISCOUNT} WHERE active = ? ORDER BY code ASC`, [filter.active ? 1 : 0])
        return rows.map(row => this.mapToDiscount(row))
    }

    async save(discount: Discount): Promise<void> {
        const existing = await this.findById(discount.id)
        if (existing) {
            await this.db.run(
                'UPDATE discounts SET code = ?, percentage = ?, active = ?, updated_at = ? WHERE id = ?',
                [discount.code, discount.percentage, discount.active ? 1 : 0, discount.updatedAt, discount.id]
            )
        } else {
            await this.db.run(
                'INSERT INTO discounts (id, code, percentage, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
                [discount.id, discount.code, discount.percentage, discount.active ? 1 : 0, discount.createdAt, discount.updatedAt]
            )
        }
    }

    async delete(id: string): Promise<void> {
        await this.db.run('DELETE FROM discounts WHERE id = ?', [id])
    }

    private mapToDiscount(row: DiscountRow): Discount {
        return {
            id: row.id,
            code: row.code,
            percentage: row.percentage,
            active: row.active === 1,
            createdAt: row.createdAt,
            updatedAt: row.updatedAt
        }
    }
}

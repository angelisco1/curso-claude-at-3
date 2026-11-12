import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SqliteOrderRepository } from './order.repository.js'
import { Database } from '@config/database.js'

const NOW = '2026-11-12T10:00:00.000Z'

describe('SqliteOrderRepository (Integration)', () => {
    let db: Database
    let repo: SqliteOrderRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteOrderRepository(db)

        await db.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['r1', 'La Trattoria', 'Calle Mayor 10', 'info@trattoria.com', '+34 612345678', 'Carlos', 'García', NOW, NOW]
        )
        for (const [id, price] of [['dish-1', 8.5], ['dish-2', 1.5]] as const) {
            await db.run(
                'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Plato ${id}`, null, price, 'principal', 1, 'r1', NOW, NOW]
            )
        }

        await repo.create({
            id: 'o1',
            restaurantId: 'r1',
            tableId: null,
            clientId: 'c1',
            createdAt: new Date(NOW),
            discountCode: null,
            discountPercentage: null,
            items: [
                { id: 'i1', dishId: 'dish-1', quantity: 1, notes: null, status: 'pendiente' },
                { id: 'i2', dishId: 'dish-2', quantity: 1, notes: null, status: 'pendiente' }
            ]
        })
    })

    afterAll(async () => {
        await db.close()
    })

    it('should read an order without discount, with its totals', async () => {
        const order = await repo.findById('o1')
        expect(order).toMatchObject({ discountCode: null, discountPercentage: null, subtotal: 10, discountAmount: 0, total: 10 })
    })

    it('should persist the discount with its fixed amounts', async () => {
        await repo.updateDiscount('o1', { code: 'DISCOUNT30', percentage: 30, subtotal: 10, discountAmount: 3, total: 7 })

        const order = await repo.findById('o1')
        expect(order).toMatchObject({ discountCode: 'DISCOUNT30', discountPercentage: 30, subtotal: 10, discountAmount: 3, total: 7 })

        const [active] = await repo.findActiveByRestaurant('r1')
        expect(active).toMatchObject({ discountCode: 'DISCOUNT30', total: 7 })

        const [mine] = await repo.findByClientId('c1')
        expect(mine).toMatchObject({ discountCode: 'DISCOUNT30', total: 7 })
    })

    it('should not change the fixed amounts when a dish price changes', async () => {
        await db.run('UPDATE dishes SET price = ? WHERE id = ?', [20, 'dish-1'])

        expect(await repo.findById('o1')).toMatchObject({ subtotal: 10, discountAmount: 3, total: 7 })
    })

    it('should remove the discount and go back to live amounts', async () => {
        await repo.updateDiscount('o1', null)
        expect(await repo.findById('o1')).toMatchObject({ discountCode: null, discountPercentage: null, subtotal: 21.5, discountAmount: 0, total: 21.5 })

        const row = await db.get<Record<string, unknown>>('SELECT subtotal, discount_amount, total FROM orders WHERE id = ?', ['o1'])
        expect(row).toEqual({ subtotal: null, discount_amount: null, total: null })
    })

    it('should add the discount columns to a pre-existing orders table', async () => {
        const legacy = new Database()
        await legacy.initialize()
        await legacy.run('ALTER TABLE orders DROP COLUMN discount_code')
        await legacy.run('ALTER TABLE orders DROP COLUMN discount_percentage')
        for (const column of ['subtotal', 'discount_amount', 'total']) {
            await legacy.run(`ALTER TABLE orders DROP COLUMN ${column}`)
        }

        // Simula arrancar la API con una base de datos creada antes de existir los descuentos
        await legacy['runInitialMigrations']()

        const columns = await legacy.all<{ name: string }>('PRAGMA table_info(orders)')
        expect(columns.map(c => c.name)).toEqual(expect.arrayContaining(['discount_code', 'discount_percentage', 'subtotal', 'discount_amount', 'total']))
        await legacy.close()
    })
})

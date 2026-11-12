import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import { dbConfig } from '@config/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-resttek-key'
const NOW = '2026-11-12T10:00:00.000Z'
const DISCOUNT_URL = '/api/v1/orders/o1/discount'

const users = {
    admin: { id: 'admin', role: 'admin', restaurantId: null },
    camarero: { id: 'w1', role: 'camarero', restaurantId: 'r1' },
    owner: { id: 'c1', role: 'cliente', restaurantId: null },
    otherClient: { id: 'c2', role: 'cliente', restaurantId: null }
}

const token = (user: keyof typeof users) => `Bearer ${jwt.sign(users[user], JWT_SECRET)}`

describe('Order discount routes (HTTP)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        await dbConfig.run(
            'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
            ['r1', 'Rest r1', 'Calle Mayor 10', 'r1@resttek.com', '+34 612345678', 'Carlos', 'García', NOW, NOW]
        )
        for (const [id, price] of [['dish-1', 8.5], ['dish-2', 1.5]] as const) {
            await dbConfig.run(
                'INSERT INTO dishes (id, name, description, price, category, available, restaurant_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Plato ${id}`, null, price, 'principal', 1, 'r1', NOW, NOW]
            )
        }
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    beforeEach(async () => {
        await dbConfig.run('DELETE FROM orders')
        await dbConfig.run('DELETE FROM discounts')
        await dbConfig.run('INSERT INTO orders (id, restaurant_id, table_id, client_id, created_at) VALUES (?, ?, ?, ?, ?)', ['o1', 'r1', null, 'c1', NOW])
        await dbConfig.run('INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, ?, ?, ?)', ['i1', 'o1', 'dish-1', 1, null, 'pendiente'])
        await dbConfig.run('INSERT INTO order_items (id, order_id, dish_id, quantity, notes, status) VALUES (?, ?, ?, ?, ?, ?)', ['i2', 'o1', 'dish-2', 1, null, 'pendiente'])
        for (const [id, code, percentage, active] of [['d1', 'DISCOUNT30', 30, 1], ['d2', 'BLACK_FRIDAY', 50, 1], ['d3', 'OLD', 10, 0]] as const) {
            await dbConfig.run('INSERT INTO discounts (id, code, percentage, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)', [id, code, percentage, active, NOW, NOW])
        }
    })

    it('should return 401 without token', async () => {
        expect((await request(app).put(DISCOUNT_URL).send({ code: 'DISCOUNT30' })).status).toBe(401)
        expect((await request(app).delete(DISCOUNT_URL)).status).toBe(401)
    })

    it('should create orders without discount', async () => {
        const res = await request(app).post('/api/v1/orders').set('Authorization', token('owner'))
            .send({ restaurantId: 'r1', items: [{ dishId: 'dish-1', quantity: 1 }] })
        expect(res.status).toBe(201)
        expect(res.body).toMatchObject({ discountCode: null, discountPercentage: null })
    })

    it('should apply a code and return the order with totals', async () => {
        const res = await request(app).put(DISCOUNT_URL).set('Authorization', token('owner')).send({ code: ' discount30 ' })

        expect(res.status).toBe(200)
        expect(res.body).toMatchObject({
            id: 'o1',
            discountCode: 'DISCOUNT30',
            discountPercentage: 30,
            subtotal: 10,
            discountAmount: 3,
            total: 7
        })

        const read = await request(app).get('/api/v1/orders/o1').set('Authorization', token('owner'))
        expect(read.body).toMatchObject({ discountCode: 'DISCOUNT30', total: 7 })
    })

    it('should keep the stored percentage when the discount changes later', async () => {
        await request(app).put(DISCOUNT_URL).set('Authorization', token('camarero')).send({ code: 'DISCOUNT30' })
        await request(app).patch('/api/v1/discounts/d1').set('Authorization', token('admin')).send({ percentage: 5, active: false })

        const read = await request(app).get('/api/v1/orders/o1').set('Authorization', token('camarero'))
        expect(read.body).toMatchObject({ discountCode: 'DISCOUNT30', discountPercentage: 30, total: 7 })
    })

    it('should keep the fixed total when a dish price changes after applying the code', async () => {
        await request(app).put(DISCOUNT_URL).set('Authorization', token('owner')).send({ code: 'DISCOUNT30' })
        await dbConfig.run('UPDATE dishes SET price = ? WHERE id = ?', [20, 'dish-1'])

        try {
            const read = await request(app).get('/api/v1/orders/o1').set('Authorization', token('owner'))
            expect(read.body).toMatchObject({ discountCode: 'DISCOUNT30', subtotal: 10, discountAmount: 3, total: 7 })

            await request(app).patch('/api/v1/orders/o1/items/i1/status').set('Authorization', token('camarero')).send({ status: 'listo' })
            const afterStatus = await request(app).get('/api/v1/orders/o1').set('Authorization', token('owner'))
            expect(afterStatus.body).toMatchObject({ total: 7 })

            await request(app).delete(DISCOUNT_URL).set('Authorization', token('owner'))
            const withoutDiscount = await request(app).get('/api/v1/orders/o1').set('Authorization', token('owner'))
            expect(withoutDiscount.body).toMatchObject({ discountCode: null, subtotal: 21.5, discountAmount: 0, total: 21.5 })
        } finally {
            await dbConfig.run('UPDATE dishes SET price = ? WHERE id = ?', [8.5, 'dish-1'])
        }
    })

    it('should be idempotent and allow only one discount per order', async () => {
        const auth = token('admin')
        await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({ code: 'DISCOUNT30' })

        expect((await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({ code: 'DISCOUNT30' })).status).toBe(200)

        const other = await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({ code: 'BLACK_FRIDAY' })
        expect(other.status).toBe(409)
        expect(other.body).toEqual({ error: 'OrderDiscountAlreadyAppliedError', message: 'Order already has a discount applied' })
    })

    it('should map code errors to 400, 404 and 409', async () => {
        const auth = token('admin')
        const invalid = await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({})
        expect(invalid.status).toBe(400)
        expect(invalid.body.error).toBe('InvalidDiscountCodeError')

        const unknown = await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({ code: 'NOPE' })
        expect(unknown.status).toBe(404)
        expect(unknown.body).toEqual({ error: 'DiscountNotFoundError', message: 'Discount not found' })

        const inactive = await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({ code: 'OLD' })
        expect(inactive.status).toBe(409)
        expect(inactive.body).toEqual({ error: 'DiscountInactiveError', message: 'Discount is not active' })
    })

    it('should return 404 OrderNotFoundError for an unknown order', async () => {
        const res = await request(app).put('/api/v1/orders/nope/discount').set('Authorization', token('admin')).send({ code: 'DISCOUNT30' })
        expect(res.status).toBe(404)
        expect(res.body).toEqual({ error: 'OrderNotFoundError', message: 'Order not found' })

        expect((await request(app).delete('/api/v1/orders/nope/discount').set('Authorization', token('admin'))).status).toBe(404)
    })

    it('should forbid a client to touch the discount of another client order', async () => {
        const apply = await request(app).put(DISCOUNT_URL).set('Authorization', token('otherClient')).send({ code: 'DISCOUNT30' })
        expect(apply.status).toBe(403)
        expect(apply.body).toEqual({ error: 'OrderAccessDeniedError', message: 'Order belongs to another client' })

        expect((await request(app).delete(DISCOUNT_URL).set('Authorization', token('otherClient'))).status).toBe(403)
    })

    it('should remove the discount with 204, idempotently', async () => {
        const auth = token('owner')
        await request(app).put(DISCOUNT_URL).set('Authorization', auth).send({ code: 'DISCOUNT30' })

        const res = await request(app).delete(DISCOUNT_URL).set('Authorization', auth)
        expect(res.status).toBe(204)
        expect((await request(app).delete(DISCOUNT_URL).set('Authorization', auth)).status).toBe(204)

        const read = await request(app).get('/api/v1/orders/o1').set('Authorization', auth)
        expect(read.body).toMatchObject({ discountCode: null, discountPercentage: null, discountAmount: 0, total: 10 })
    })
})

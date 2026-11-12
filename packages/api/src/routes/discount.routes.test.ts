import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import { dbConfig } from '@config/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-resttek-key'
const NOW = '2026-11-12T10:00:00.000Z'
const BASE = '/api/v1/discounts'

const users = {
    admin: { id: 'admin', role: 'admin', restaurantId: null },
    manager: { id: 'm1', role: 'manager', restaurantId: 'r1' },
    camarero: { id: 'w1', role: 'camarero', restaurantId: 'r1' },
    cocinero: { id: 'k1', role: 'cocinero', restaurantId: 'r1' },
    cliente: { id: 'c1', role: 'cliente', restaurantId: null }
}

const token = (user: keyof typeof users) => `Bearer ${jwt.sign(users[user], JWT_SECRET)}`

async function insertDiscount(id: string, code: string, percentage: number, active = true) {
    await dbConfig.run(
        'INSERT INTO discounts (id, code, percentage, active, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)',
        [id, code, percentage, active ? 1 : 0, NOW, NOW]
    )
}

describe('Discount routes (HTTP)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    beforeEach(async () => {
        await dbConfig.run('DELETE FROM discounts')
        await insertDiscount('d1', 'DISCOUNT30', 30)
        await insertDiscount('d2', 'BLACK_FRIDAY', 50, false)
    })

    describe('authentication and roles', () => {
        it('should return 401 without token', async () => {
            const res = await request(app).get(BASE)
            expect(res.status).toBe(401)
        })

        it.each(['manager', 'camarero', 'cocinero', 'cliente'] as const)('should forbid %s every operation', async (user) => {
            const auth = token(user)
            expect((await request(app).get(BASE).set('Authorization', auth)).status).toBe(403)
            expect((await request(app).get(`${BASE}/d1`).set('Authorization', auth)).status).toBe(403)
            expect((await request(app).post(BASE).set('Authorization', auth).send({ code: 'NEW', percentage: 5 })).status).toBe(403)
            expect((await request(app).patch(`${BASE}/d1`).set('Authorization', auth).send({ active: false })).status).toBe(403)
            const res = await request(app).delete(`${BASE}/d1`).set('Authorization', auth)
            expect(res.status).toBe(403)
            expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' })
        })
    })

    describe('POST /discounts', () => {
        it('should create a discount with a normalized code and a Location header', async () => {
            const res = await request(app).post(BASE).set('Authorization', token('admin')).send({ code: ' summer_sale ', percentage: 15 })

            expect(res.status).toBe(201)
            expect(res.body).toEqual({
                id: expect.any(String),
                code: 'SUMMER_SALE',
                percentage: 15,
                active: true,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            })
            expect(res.headers.location).toBe(`${BASE}/${res.body.id}`)
        })

        it('should return 400 for invalid data', async () => {
            const auth = token('admin')
            const badCode = await request(app).post(BASE).set('Authorization', auth).send({ code: 'A B', percentage: 10 })
            expect(badCode.status).toBe(400)
            expect(badCode.body.error).toBe('InvalidDiscountCodeError')

            const badPercentage = await request(app).post(BASE).set('Authorization', auth).send({ code: 'NEW', percentage: 101 })
            expect(badPercentage.status).toBe(400)
            expect(badPercentage.body).toEqual({
                error: 'InvalidDiscountPercentageError',
                message: 'Discount percentage must be an integer between 1 and 100'
            })

            const badActive = await request(app).post(BASE).set('Authorization', auth).send({ code: 'NEW', percentage: 10, active: 'no' })
            expect(badActive.status).toBe(400)
            expect(badActive.body.error).toBe('InvalidDiscountActiveError')
        })

        it('should return 409 for a duplicated code', async () => {
            const res = await request(app).post(BASE).set('Authorization', token('admin')).send({ code: 'discount30', percentage: 10 })
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'DuplicatedDiscountCodeError', message: 'Discount code already exists' })
        })
    })

    describe('GET /discounts', () => {
        it('should list all discounts sorted by code', async () => {
            const res = await request(app).get(BASE).set('Authorization', token('admin'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual([
                { id: 'd2', code: 'BLACK_FRIDAY', percentage: 50, active: false, createdAt: NOW, updatedAt: NOW },
                { id: 'd1', code: 'DISCOUNT30', percentage: 30, active: true, createdAt: NOW, updatedAt: NOW }
            ])
        })

        it('should filter by active and validate the filter', async () => {
            const auth = token('admin')
            const active = await request(app).get(`${BASE}?active=true`).set('Authorization', auth)
            expect(active.body.map((d: { code: string }) => d.code)).toEqual(['DISCOUNT30'])

            const inactive = await request(app).get(`${BASE}?active=false`).set('Authorization', auth)
            expect(inactive.body.map((d: { code: string }) => d.code)).toEqual(['BLACK_FRIDAY'])

            const bad = await request(app).get(`${BASE}?active=yes`).set('Authorization', auth)
            expect(bad.status).toBe(400)
            expect(bad.body.error).toBe('InvalidDiscountActiveError')
        })
    })

    describe('GET, PATCH and DELETE /discounts/{id}', () => {
        it('should get a discount or return 404', async () => {
            const auth = token('admin')
            const ok = await request(app).get(`${BASE}/d1`).set('Authorization', auth)
            expect(ok.status).toBe(200)
            expect(ok.body.code).toBe('DISCOUNT30')

            const missing = await request(app).get(`${BASE}/nope`).set('Authorization', auth)
            expect(missing.status).toBe(404)
            expect(missing.body).toEqual({ error: 'DiscountNotFoundError', message: 'Discount not found' })
        })

        it('should partially update a discount ignoring the code', async () => {
            const res = await request(app).patch(`${BASE}/d1`).set('Authorization', token('admin')).send({ active: false, code: 'OTHER' })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: 'd1', code: 'DISCOUNT30', percentage: 30, active: false })

            const percentage = await request(app).patch(`${BASE}/d1`).set('Authorization', token('admin')).send({ percentage: 0 })
            expect(percentage.status).toBe(400)
            expect(percentage.body.error).toBe('InvalidDiscountPercentageError')

            const missing = await request(app).patch(`${BASE}/nope`).set('Authorization', token('admin')).send({ active: true })
            expect(missing.status).toBe(404)
        })

        it('should delete a discount (204) and then return 404', async () => {
            const auth = token('admin')
            const res = await request(app).delete(`${BASE}/d1`).set('Authorization', auth)
            expect(res.status).toBe(204)
            expect(res.body).toEqual({})

            expect((await request(app).delete(`${BASE}/d1`).set('Authorization', auth)).status).toBe(404)
        })
    })
})

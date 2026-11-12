import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import app from '../app.js'
import { dbConfig } from '@config/database.js'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-resttek-key'
const NOW = '2026-11-12T10:00:00.000Z'
const BASE = '/api/v1/restaurants/r1/tables'

const users = {
    admin: { id: 'admin', role: 'admin', restaurantId: null },
    manager: { id: 'm1', role: 'manager', restaurantId: 'r1' },
    camarero: { id: 'w1', role: 'camarero', restaurantId: 'r1' },
    camareroOtro: { id: 'w2', role: 'camarero', restaurantId: 'r2' },
    cocinero: { id: 'k1', role: 'cocinero', restaurantId: 'r1' },
    cliente1: { id: 'c1', role: 'cliente', restaurantId: null },
    cliente2: { id: 'c2', role: 'cliente', restaurantId: null }
}

const token = (user: keyof typeof users) => `Bearer ${jwt.sign(users[user], JWT_SECRET)}`

async function insertTable(id: string, number: number, capacity = 4, restaurantId = 'r1') {
    await dbConfig.run(
        'INSERT INTO tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?)',
        [id, restaurantId, number, null, capacity, 'libre', NOW, NOW]
    )
}

describe('Table routes (HTTP)', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        for (const id of ['r1', 'r2']) {
            await dbConfig.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Rest ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', NOW, NOW]
            )
        }
        for (const [id, email] of [['c1', 'cliente1@resttek.com'], ['c2', 'cliente2@resttek.com']]) {
            await dbConfig.run(
                'INSERT INTO employees (id, first_name, last_name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, 'Cli', 'Ente', email, 'hash', 'cliente', null]
            )
        }
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    beforeEach(async () => {
        await dbConfig.run('DELETE FROM tables')
        await insertTable('t1', 1, 2)
        await insertTable('t2', 2, 4)
    })

    describe('authentication and roles', () => {
        it('should return 401 without token', async () => {
            const res = await request(app).get(BASE)
            expect(res.status).toBe(401)
        })

        it.each(['admin', 'manager', 'camarero', 'cocinero'] as const)('should let %s list tables', async (user) => {
            const res = await request(app).get(BASE).set('Authorization', token(user))
            expect(res.status).toBe(200)
            expect(res.body.map((t: { number: number }) => t.number)).toEqual([1, 2])
        })

        it('should forbid a cliente to list or get tables', async () => {
            expect((await request(app).get(BASE).set('Authorization', token('cliente1'))).status).toBe(403)
            expect((await request(app).get(`${BASE}/t1`).set('Authorization', token('cliente1'))).status).toBe(403)
        })

        it('should forbid an employee of another restaurant', async () => {
            const res = await request(app).get(BASE).set('Authorization', token('camareroOtro'))
            expect(res.status).toBe(403)
            expect(res.body).toEqual({ error: 'Forbidden: Restaurant access denied' })
        })

        it.each(['manager', 'camarero', 'cocinero', 'cliente1'] as const)('should forbid %s to create, update or delete', async (user) => {
            const auth = token(user)
            expect((await request(app).post(BASE).set('Authorization', auth).send({ number: 9, capacity: 2 })).status).toBe(403)
            expect((await request(app).put(`${BASE}/t1`).set('Authorization', auth).send({ number: 1, capacity: 2 })).status).toBe(403)
            expect((await request(app).delete(`${BASE}/t1`).set('Authorization', auth)).status).toBe(403)
        })

        it('should forbid cocinero and cliente to change the status', async () => {
            expect((await request(app).patch(`${BASE}/t1/status`).set('Authorization', token('cocinero')).send({ status: 'libre' })).status).toBe(403)
            expect((await request(app).patch(`${BASE}/t1/status`).set('Authorization', token('cliente1')).send({ status: 'libre' })).status).toBe(403)
        })

        it.each(['manager', 'camarero', 'cocinero'] as const)('should forbid %s to occupy', async (user) => {
            const res = await request(app).post(`${BASE}/t1/occupy`).set('Authorization', token(user)).send({ people: 2 })
            expect(res.status).toBe(403)
        })

        it('should forbid cocinero to list available tables', async () => {
            const res = await request(app).get(`${BASE}/available?people=2`).set('Authorization', token('cocinero'))
            expect(res.status).toBe(403)
        })
    })

    describe('CRUD (admin)', () => {
        it('should create a table and return it in the contract format', async () => {
            const res = await request(app).post(BASE).set('Authorization', token('admin')).send({ number: 7, description: ' Terraza ', capacity: 4 })

            expect(res.status).toBe(201)
            expect(res.body).toEqual({
                id: expect.any(String),
                restaurantId: 'r1',
                number: 7,
                description: 'Terraza',
                capacity: 4,
                status: 'libre',
                reservedForClientId: null,
                reservedForEmail: null,
                occupiedByClientId: null,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            })
        })

        it('should ignore a status sent on creation', async () => {
            const res = await request(app).post(BASE).set('Authorization', token('admin')).send({ number: 7, capacity: 4, status: 'ocupada' })
            expect(res.body.status).toBe('libre')
        })

        it('should map validation and conflict errors', async () => {
            const auth = token('admin')
            const badNumber = await request(app).post(BASE).set('Authorization', auth).send({ number: 0, capacity: 4 })
            expect(badNumber.status).toBe(400)
            expect(badNumber.body.error).toBe('InvalidTableNumberError')

            const badCapacity = await request(app).put(`${BASE}/t1`).set('Authorization', auth).send({ number: 1, capacity: 0 })
            expect(badCapacity.status).toBe(400)
            expect(badCapacity.body.error).toBe('InvalidTableCapacityError')

            const duplicated = await request(app).put(`${BASE}/t1`).set('Authorization', auth).send({ number: 2, capacity: 4 })
            expect(duplicated.status).toBe(409)
            expect(duplicated.body).toEqual({ error: 'DuplicatedTableNumberError', message: 'Table number already exists in this restaurant' })

            const noRestaurant = await request(app).post('/api/v1/restaurants/nope/tables').set('Authorization', auth).send({ number: 1, capacity: 4 })
            expect(noRestaurant.status).toBe(404)
            expect(noRestaurant.body.error).toBe('RestaurantNotFoundError')
        })

        it('should return 404 TableNotFoundError for a table of another restaurant', async () => {
            const res = await request(app).get('/api/v1/restaurants/r2/tables/t1').set('Authorization', token('admin'))
            expect(res.status).toBe(404)
            expect(res.body.error).toBe('TableNotFoundError')
        })

        it('should return [] for a restaurant without tables', async () => {
            const res = await request(app).get('/api/v1/restaurants/r2/tables').set('Authorization', token('admin'))
            expect(res.status).toBe(200)
            expect(res.body).toEqual([])
        })

        it('should delete a free table (204) but not an occupied one (409)', async () => {
            const auth = token('admin')
            expect((await request(app).delete(`${BASE}/t1`).set('Authorization', auth)).status).toBe(204)

            await request(app).patch(`${BASE}/t2/status`).set('Authorization', auth).send({ status: 'ocupada' })
            const res = await request(app).delete(`${BASE}/t2`).set('Authorization', auth)
            expect(res.status).toBe(409)
            expect(res.body.error).toBe('TableOccupiedError')
        })
    })

    describe('status, availability and occupation', () => {
        it('should let a camarero reserve for a client by email and return the full table', async () => {
            const res = await request(app).patch(`${BASE}/t2/status`).set('Authorization', token('camarero'))
                .send({ status: 'reservada', reservedForEmail: 'cliente1@resttek.com' })

            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: 't2', status: 'reservada', reservedForClientId: 'c1', reservedForEmail: 'cliente1@resttek.com', occupiedByClientId: null })
        })

        it('should reject an invalid status or an unknown client with 400', async () => {
            const auth = token('manager')
            const badStatus = await request(app).patch(`${BASE}/t1/status`).set('Authorization', auth).send({ status: 'cerrada' })
            expect(badStatus.status).toBe(400)
            expect(badStatus.body.error).toBe('InvalidTableStatusError')

            const badClient = await request(app).patch(`${BASE}/t1/status`).set('Authorization', auth).send({ status: 'reservada', reservedForEmail: 'nadie@resttek.com' })
            expect(badClient.status).toBe(400)
            expect(badClient.body.error).toBe('InvalidReservationClientError')
        })

        it('should list available tables with flags and validate people', async () => {
            const admin = token('admin')
            await request(app).patch(`${BASE}/t2/status`).set('Authorization', admin).send({ status: 'reservada', reservedForEmail: 'cliente1@resttek.com' })

            const mine = await request(app).get(`${BASE}/available?people=2`).set('Authorization', token('cliente1'))
            expect(mine.status).toBe(200)
            expect(mine.body.map((t: { id: string; reservedForMe: boolean; occupiedByMe: boolean }) => [t.id, t.reservedForMe, t.occupiedByMe]))
                .toEqual([['t1', false, false], ['t2', true, false]])

            const other = await request(app).get(`${BASE}/available?people=2`).set('Authorization', token('cliente2'))
            expect(other.body.map((t: { id: string }) => t.id)).toEqual(['t1'])

            const none = await request(app).get(`${BASE}/available?people=10`).set('Authorization', token('cliente1'))
            expect(none.status).toBe(200)
            expect(none.body).toEqual([])

            for (const query of ['', '?people=0', '?people=abc', '?people=1.5']) {
                const bad = await request(app).get(`${BASE}/available${query}`).set('Authorization', token('cliente1'))
                expect(bad.status).toBe(400)
                expect(bad.body.error).toBe('InvalidPeopleCountError')
            }
        })

        it('should occupy idempotently for the same client and return 409 for another one', async () => {
            const first = await request(app).post(`${BASE}/t2/occupy`).set('Authorization', token('cliente1')).send({ people: 3 })
            expect(first.status).toBe(200)
            expect(first.body).toMatchObject({ id: 't2', status: 'ocupada', occupiedByClientId: 'c1', reservedForClientId: null })

            const again = await request(app).post(`${BASE}/t2/occupy`).set('Authorization', token('cliente1')).send({ people: 3 })
            expect(again.status).toBe(200)

            const other = await request(app).post(`${BASE}/t2/occupy`).set('Authorization', token('cliente2')).send({ people: 3 })
            expect(other.status).toBe(409)
            expect(other.body).toEqual({ error: 'TableNotAvailableError', message: 'Table is not available' })

            const available = await request(app).get(`${BASE}/available?people=3`).set('Authorization', token('cliente1'))
            expect(available.body).toEqual([expect.objectContaining({ id: 't2', occupiedByMe: true, reservedForMe: false })])
        })

        it('should validate people and return 404 for an unknown table on occupy', async () => {
            const bad = await request(app).post(`${BASE}/t1/occupy`).set('Authorization', token('cliente1')).send({ people: 0 })
            expect(bad.status).toBe(400)
            expect(bad.body.error).toBe('InvalidPeopleCountError')

            const missing = await request(app).post(`${BASE}/nope/occupy`).set('Authorization', token('cliente1')).send({ people: 2 })
            expect(missing.status).toBe(404)
            expect(missing.body.error).toBe('TableNotFoundError')
        })

        it('should let a camarero free an occupied table', async () => {
            await request(app).post(`${BASE}/t1/occupy`).set('Authorization', token('cliente1')).send({ people: 2 })
            const res = await request(app).patch(`${BASE}/t1/status`).set('Authorization', token('camarero')).send({ status: 'libre' })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ status: 'libre', occupiedByClientId: null })
        })
    })
})

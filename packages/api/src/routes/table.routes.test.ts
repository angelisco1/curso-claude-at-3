import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import express from 'express'
import request from 'supertest'
import jwt from 'jsonwebtoken'
import { dbConfig } from '@config/database.js'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'
import tableRoutes from './table.routes.js'

const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-resttek-key'
const BASE = '/api/v1/restaurants/r1/tables'
const now = '2026-11-12T10:00:00.000Z'

const roles = ['admin', 'manager', 'camarero', 'cocinero', 'cliente'] as const
type Role = typeof roles[number]

function tokenFor(role: Role, id = `${role}-1`): string {
    return `Bearer ${jwt.sign({ id, email: `${id}@resttek.com`, role }, JWT_SECRET)}`
}

async function insertTable(id: string, number: number, capacity: number, status = 'libre', reservedFor: string | null = null, restaurantId = 'r1') {
    await dbConfig.run(
        'INSERT INTO tables (id, restaurant_id, number, description, capacity, status, reserved_for, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        [id, restaurantId, number, null, capacity, status, reservedFor, now, now]
    )
}

const app = express()
app.use(express.json())
app.use('/api/v1/restaurants/:restaurantId/tables', tableRoutes)
app.use(errorHandler)

describe('table.routes', () => {
    beforeAll(async () => {
        await dbConfig.initialize()
        for (const id of ['r1', 'r2']) {
            await dbConfig.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Restaurante ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', now, now]
            )
        }
    })

    beforeEach(async () => {
        await dbConfig.run('DELETE FROM tables')
    })

    afterAll(async () => {
        await dbConfig.close()
    })

    describe('autenticación y roles', () => {
        it('responde 401 sin token', async () => {
            const res = await request(app).get(BASE)
            expect(res.status).toBe(401)
            expect(res.body).toEqual({ error: 'Unauthorized: No token provided' })
        })

        const allowed: Record<string, Role[]> = {
            'GET /': ['admin', 'manager', 'camarero', 'cocinero'],
            'GET /:id': ['admin', 'manager', 'camarero', 'cocinero'],
            'POST /': ['admin'],
            'PUT /:id': ['admin'],
            'DELETE /:id': ['admin'],
            'PATCH /:id/status': ['admin', 'manager', 'camarero'],
            'GET /available': [...roles],
            'POST /:id/occupy': [...roles]
        }

        function send(op: string, role: Role) {
            const [method, path] = op.split(' ') as [string, string]
            const url = BASE + path.replace(/\/$/, '').replace(':id', 't1') + (path === '/available' ? '?people=2' : '')
            const req = (request(app) as any)[method.toLowerCase()](url).set('Authorization', tokenFor(role))
            const bodies: Record<string, object> = {
                'POST /': { number: 9, capacity: 2 },
                'PUT /:id': { number: 1, capacity: 4 },
                'PATCH /:id/status': { status: 'libre' },
                'POST /:id/occupy': { people: 2 }
            }
            return bodies[op] ? req.send(bodies[op]) : req
        }

        for (const [op, allowedRoles] of Object.entries(allowed)) {
            for (const role of roles) {
                const expected = allowedRoles.includes(role) ? 'permite' : 'prohíbe (403)'
                it(`${op}: ${expected} a ${role}`, async () => {
                    await insertTable('t1', 1, 4)
                    const res = await send(op, role)
                    if (allowedRoles.includes(role)) {
                        expect(res.status).toBeLessThan(300)
                    } else {
                        expect(res.status).toBe(403)
                        expect(res.body).toEqual({ error: 'Forbidden: Insufficient permissions' })
                    }
                })
            }
        }
    })

    describe('CRUD (admin)', () => {
        const admin = tokenFor('admin')

        it('POST / crea una mesa (201) con el formato del contrato', async () => {
            const res = await request(app).post(BASE).set('Authorization', admin)
                .send({ number: 7, capacity: 4, description: '  Terraza ' })

            expect(res.status).toBe(201)
            expect(Object.keys(res.body).sort()).toEqual(['capacity', 'createdAt', 'description', 'id', 'number', 'reservedFor', 'restaurantId', 'status', 'updatedAt'])
            expect(res.body).toMatchObject({ restaurantId: 'r1', number: 7, capacity: 4, description: 'Terraza', status: 'libre', reservedFor: null })
        })

        it('POST / responde 400 con datos inválidos', async () => {
            const res = await request(app).post(BASE).set('Authorization', admin).send({ number: 0, capacity: 4 })
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidTableNumberError')
        })

        it('POST / responde 409 con número duplicado', async () => {
            await insertTable('t1', 1, 4)
            const res = await request(app).post(BASE).set('Authorization', admin).send({ number: 1, capacity: 2 })
            expect(res.status).toBe(409)
            expect(res.body).toEqual({ error: 'DuplicatedTableNumberError', message: 'Table number already exists in this restaurant' })
        })

        it('GET / lista las mesas del restaurante ordenadas por número', async () => {
            await insertTable('t2', 2, 4)
            await insertTable('t1', 1, 4)
            await insertTable('tx', 3, 4, 'libre', null, 'r2')
            const res = await request(app).get(BASE).set('Authorization', admin)
            expect(res.status).toBe(200)
            expect(res.body.map((t: { id: string }) => t.id)).toEqual(['t1', 't2'])
        })

        it('GET /:id responde 404 si la mesa es de otro restaurante', async () => {
            await insertTable('tx', 1, 4, 'libre', null, 'r2')
            const res = await request(app).get(`${BASE}/tx`).set('Authorization', admin)
            expect(res.status).toBe(404)
            expect(res.body).toEqual({ error: 'TableNotFoundError', message: 'Table not found' })
        })

        it('PUT /:id actualiza (200) y permite mantener su número', async () => {
            await insertTable('t1', 1, 4)
            const res = await request(app).put(`${BASE}/t1`).set('Authorization', admin)
                .send({ number: 1, capacity: 6, status: 'reservada' })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ id: 't1', number: 1, capacity: 6, description: null, status: 'reservada', reservedFor: null })
        })

        it('DELETE /:id borra (204 sin cuerpo) y responde 409 si está ocupada', async () => {
            await insertTable('t1', 1, 4)
            await insertTable('t2', 2, 4, 'ocupada')

            const ok = await request(app).delete(`${BASE}/t1`).set('Authorization', admin)
            expect(ok.status).toBe(204)
            expect(ok.text).toBe('')

            const conflict = await request(app).delete(`${BASE}/t2`).set('Authorization', admin)
            expect(conflict.status).toBe(409)
            expect(conflict.body.error).toBe('TableOccupiedError')
        })
    })

    describe('PATCH /:id/status', () => {
        const camarero = tokenFor('camarero')

        it('cambia el estado y fija reservedFor', async () => {
            await insertTable('t1', 1, 4)
            const res = await request(app).patch(`${BASE}/t1/status`).set('Authorization', camarero)
                .send({ status: 'reservada', reservedFor: 'cliente-1' })
            expect(res.status).toBe(200)
            expect(res.body).toMatchObject({ status: 'reservada', reservedFor: 'cliente-1' })
        })

        it('responde 400 con estado inválido o reservedFor con otro estado', async () => {
            await insertTable('t1', 1, 4)
            const bad = await request(app).patch(`${BASE}/t1/status`).set('Authorization', camarero).send({ status: 'cerrada' })
            expect(bad.status).toBe(400)
            expect(bad.body.error).toBe('InvalidTableStatusError')

            const badReserved = await request(app).patch(`${BASE}/t1/status`).set('Authorization', camarero)
                .send({ status: 'libre', reservedFor: 'cliente-1' })
            expect(badReserved.status).toBe(400)
            expect(badReserved.body.error).toBe('InvalidReservedForError')
        })
    })

    describe('vista de cliente (available y occupy)', () => {
        const cliente = tokenFor('cliente', 'cliente-1')

        beforeEach(async () => {
            await insertTable('libre-2', 1, 2)
            await insertTable('libre-6', 2, 6)
            await insertTable('mia', 3, 4, 'reservada', 'cliente-1')
            await insertTable('otro', 4, 4, 'reservada', 'cliente-2')
            await insertTable('ocupada', 5, 4, 'ocupada')
        })

        it('GET /available devuelve ClientTable[] con reservedForMe y sin reservedFor', async () => {
            const res = await request(app).get(`${BASE}/available?people=3`).set('Authorization', cliente)
            expect(res.status).toBe(200)
            expect(res.body.map((t: { id: string }) => t.id)).toEqual(['mia', 'libre-6'])
            expect(res.body[0]).toMatchObject({ reservedForMe: true })
            expect(res.body[1]).toMatchObject({ reservedForMe: false })
            expect(res.body[0]).not.toHaveProperty('reservedFor')
        })

        it('GET /available devuelve [] si no hay mesas', async () => {
            const res = await request(app).get(`${BASE}/available?people=20`).set('Authorization', cliente)
            expect(res.status).toBe(200)
            expect(res.body).toEqual([])
        })

        it.each(['', '?people=0', '?people=abc', '?people=2.5', '?people=-1'])('GET /available%s responde 400', async (query) => {
            const res = await request(app).get(`${BASE}/available${query}`).set('Authorization', cliente)
            expect(res.status).toBe(400)
            expect(res.body.error).toBe('InvalidPeopleCountError')
        })

        it('POST /:id/occupy ocupa (200) y una segunda vez responde 409', async () => {
            const first = await request(app).post(`${BASE}/libre-6/occupy`).set('Authorization', cliente).send({ people: 3 })
            expect(first.status).toBe(200)
            expect(first.body).toMatchObject({ id: 'libre-6', status: 'ocupada', reservedForMe: false })
            expect(first.body).not.toHaveProperty('reservedFor')

            const second = await request(app).post(`${BASE}/libre-6/occupy`).set('Authorization', tokenFor('cliente', 'cliente-2')).send({ people: 3 })
            expect(second.status).toBe(409)
            expect(second.body).toEqual({ error: 'TableNotAvailableError', message: 'Table is not available' })
        })

        it('POST /:id/occupy permite la reserva propia y rechaza la ajena', async () => {
            const mine = await request(app).post(`${BASE}/mia/occupy`).set('Authorization', cliente).send({ people: 2 })
            expect(mine.status).toBe(200)

            const other = await request(app).post(`${BASE}/otro/occupy`).set('Authorization', cliente).send({ people: 2 })
            expect(other.status).toBe(409)
        })

        it('POST /:id/occupy responde 400 con people inválido y 404 si no existe', async () => {
            const bad = await request(app).post(`${BASE}/libre-2/occupy`).set('Authorization', cliente).send({ people: '2' })
            expect(bad.status).toBe(400)
            expect(bad.body.error).toBe('InvalidPeopleCountError')

            const missing = await request(app).post(`${BASE}/no-existe/occupy`).set('Authorization', cliente).send({ people: 2 })
            expect(missing.status).toBe(404)
        })
    })
})

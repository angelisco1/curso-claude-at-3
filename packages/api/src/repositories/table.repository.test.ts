import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { SqliteTableRepository } from './table.repository.js'
import { Database } from '@config/database.js'
import type { Table } from '@models/table.model.js'

const now = new Date().toISOString()

function buildTable(overrides: Partial<Table> = {}): Table {
    return {
        id: 't1',
        restaurantId: 'r1',
        number: 1,
        description: 'Ventana',
        capacity: 4,
        status: 'libre',
        reservedFor: null,
        createdAt: now,
        updatedAt: now,
        ...overrides
    }
}

describe('SqliteTableRepository (Integration)', () => {
    let db: Database
    let repo: SqliteTableRepository

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteTableRepository(db)

        for (const id of ['r1', 'r2']) {
            await db.run(
                'INSERT INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
                [id, `Restaurante ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', now, now]
            )
        }
    })

    beforeEach(async () => {
        await db.run('DELETE FROM tables')
    })

    afterAll(async () => {
        await db.close()
    })

    describe('CRUD', () => {
        it('guarda y busca una mesa por id', async () => {
            await repo.save(buildTable())

            const found = await repo.findById('t1')
            expect(found).toEqual(buildTable())
        })

        it('devuelve null si la mesa no existe', async () => {
            expect(await repo.findById('no-existe')).toBeNull()
        })

        it('lista las mesas de un restaurante ordenadas por número', async () => {
            await repo.save(buildTable({ id: 't3', number: 3 }))
            await repo.save(buildTable({ id: 't1', number: 1 }))
            await repo.save(buildTable({ id: 'tx', number: 2, restaurantId: 'r2' }))

            const tables = await repo.findByRestaurant('r1')
            expect(tables.map(t => t.number)).toEqual([1, 3])
        })

        it('actualiza una mesa existente', async () => {
            await repo.save(buildTable())
            await repo.save(buildTable({ number: 9, description: null, capacity: 6, status: 'reservada', reservedFor: 'c1', updatedAt: 'later' }))

            const found = await repo.findById('t1')
            expect(found).toMatchObject({ number: 9, description: null, capacity: 6, status: 'reservada', reservedFor: 'c1', updatedAt: 'later' })
        })

        it('borra una mesa', async () => {
            await repo.save(buildTable())
            await repo.delete('t1')
            expect(await repo.findById('t1')).toBeNull()
        })
    })
})

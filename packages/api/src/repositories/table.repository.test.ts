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

    describe('findAvailable', () => {
        beforeEach(async () => {
            await repo.save(buildTable({ id: 'libre-2', number: 1, capacity: 2 }))
            await repo.save(buildTable({ id: 'libre-6', number: 2, capacity: 6 }))
            await repo.save(buildTable({ id: 'libre-4', number: 3, capacity: 4 }))
            await repo.save(buildTable({ id: 'ocupada-4', number: 4, capacity: 4, status: 'ocupada' }))
            await repo.save(buildTable({ id: 'res-mia', number: 5, capacity: 4, status: 'reservada', reservedFor: 'c1' }))
            await repo.save(buildTable({ id: 'res-otro', number: 6, capacity: 4, status: 'reservada', reservedFor: 'c2' }))
            await repo.save(buildTable({ id: 'res-anonima', number: 7, capacity: 4, status: 'reservada', reservedFor: null }))
            await repo.save(buildTable({ id: 'otro-rest', number: 1, capacity: 8, restaurantId: 'r2' }))
        })

        it('devuelve libres y reservadas para el usuario con capacidad suficiente, ordenadas por capacidad y número', async () => {
            const tables = await repo.findAvailable('r1', 3, 'c1')
            expect(tables.map(t => t.id)).toEqual(['libre-4', 'res-mia', 'libre-6'])
        })

        it('no incluye reservas de otros ni anónimas', async () => {
            const tables = await repo.findAvailable('r1', 1, 'c2')
            expect(tables.map(t => t.id)).toEqual(['libre-2', 'libre-4', 'res-otro', 'libre-6'])
        })

        it('devuelve un array vacío si ninguna mesa tiene capacidad suficiente', async () => {
            expect(await repo.findAvailable('r1', 7, 'c1')).toEqual([])
        })
    })

    describe('updateStatus', () => {
        it('cambia estado, reservedFor y updatedAt', async () => {
            await repo.save(buildTable())
            await repo.updateStatus('t1', 'reservada', 'c1', 'later')

            expect(await repo.findById('t1')).toMatchObject({ status: 'reservada', reservedFor: 'c1', updatedAt: 'later' })
        })
    })

    describe('occupyIfAvailable', () => {
        it('ocupa una mesa libre con capacidad suficiente', async () => {
            await repo.save(buildTable())

            expect(await repo.occupyIfAvailable('t1', 'r1', 4, 'c1', 'later')).toBe(true)
            expect(await repo.findById('t1')).toMatchObject({ status: 'ocupada', reservedFor: null, updatedAt: 'later' })
        })

        it('ocupa una mesa reservada para el propio usuario y limpia la reserva', async () => {
            await repo.save(buildTable({ status: 'reservada', reservedFor: 'c1' }))

            expect(await repo.occupyIfAvailable('t1', 'r1', 2, 'c1', 'later')).toBe(true)
            expect(await repo.findById('t1')).toMatchObject({ status: 'ocupada', reservedFor: null })
        })

        it.each([
            ['reservada para otro', { status: 'reservada' as const, reservedFor: 'c2' }, 2, 'r1'],
            ['reservada anónima', { status: 'reservada' as const, reservedFor: null }, 2, 'r1'],
            ['con capacidad insuficiente', {}, 5, 'r1'],
            ['de otro restaurante', {}, 2, 'r2']
        ])('no ocupa una mesa %s', async (_label, overrides, people, restaurantId) => {
            await repo.save(buildTable(overrides))

            expect(await repo.occupyIfAvailable('t1', restaurantId, people, 'c1', 'later')).toBe(false)
            expect(await repo.findById('t1')).toMatchObject({ status: overrides.status ?? 'libre', updatedAt: now })
        })
    })
})

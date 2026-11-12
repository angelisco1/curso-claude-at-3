import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { Database } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import type { Table } from '@models/table.model.js'

const NOW = '2026-11-12T10:00:00.000Z'

function buildTable(overrides: Partial<Table> = {}): Table {
    return {
        id: 't1',
        restaurantId: 'r1',
        number: 1,
        description: null,
        capacity: 4,
        status: 'libre',
        reservedFor: null,
        reservedForEmail: null,
        occupiedBy: null,
        createdAt: NOW,
        updatedAt: NOW,
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
                [id, `Rest ${id}`, 'Calle Mayor 10', `${id}@resttek.com`, '+34 612345678', 'Carlos', 'García', NOW, NOW]
            )
        }
        for (const [id, email] of [['c1', 'cliente1@resttek.com'], ['c2', 'cliente2@resttek.com']]) {
            await db.run(
                'INSERT INTO employees (id, first_name, last_name, email, password_hash, role, restaurant_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
                [id, 'Cli', 'Ente', email, 'hash', 'cliente', null]
            )
        }
    })

    afterAll(async () => {
        await db.close()
    })

    beforeEach(async () => {
        await db.run('DELETE FROM tables')
    })

    it('should save and find a table by id', async () => {
        await repo.save(buildTable({ description: 'Ventana' }))

        const found = await repo.findById('t1')
        expect(found).toEqual(buildTable({ description: 'Ventana' }))
    })

    it('should return null for an unknown id', async () => {
        expect(await repo.findById('nope')).toBeNull()
    })

    it('should update number, description and capacity on save of an existing table', async () => {
        await repo.save(buildTable())
        await repo.save(buildTable({ number: 9, description: 'Terraza', capacity: 6, updatedAt: '2026-11-12T11:00:00.000Z' }))

        const found = await repo.findById('t1')
        expect(found?.number).toBe(9)
        expect(found?.description).toBe('Terraza')
        expect(found?.capacity).toBe(6)
        expect(found?.updatedAt).toBe('2026-11-12T11:00:00.000Z')
    })

    it('should list tables of a restaurant ordered by number', async () => {
        await repo.save(buildTable({ id: 't3', number: 3 }))
        await repo.save(buildTable({ id: 't1', number: 1 }))
        await repo.save(buildTable({ id: 'other', number: 2, restaurantId: 'r2' }))

        const tables = await repo.findByRestaurant('r1')
        expect(tables.map(t => t.id)).toEqual(['t1', 't3'])
    })

    it('should find a table by restaurant and number', async () => {
        await repo.save(buildTable({ id: 't1', number: 5 }))

        expect((await repo.findByNumber('r1', 5))?.id).toBe('t1')
        expect(await repo.findByNumber('r2', 5)).toBeNull()
    })

    it('should reject a duplicated number in the same restaurant but allow it in another', async () => {
        await repo.save(buildTable({ id: 't1', number: 1 }))
        await expect(repo.save(buildTable({ id: 't2', number: 1 }))).rejects.toThrow()
        await expect(repo.save(buildTable({ id: 't3', number: 1, restaurantId: 'r2' }))).resolves.toBeUndefined()
    })

    it('should delete a table', async () => {
        await repo.save(buildTable())
        await repo.delete('t1')
        expect(await repo.findById('t1')).toBeNull()
    })

    describe('updateStatus', () => {
        it('should set status and reservation owner, clear occupant and expose the owner email', async () => {
            await repo.save(buildTable())
            await db.run("UPDATE tables SET status = 'ocupada', occupied_by = 'c2' WHERE id = 't1'")

            await repo.updateStatus('t1', 'reservada', 'c1', '2026-11-12T12:00:00.000Z')

            const found = await repo.findById('t1')
            expect(found?.status).toBe('reservada')
            expect(found?.reservedFor).toBe('c1')
            expect(found?.reservedForEmail).toBe('cliente1@resttek.com')
            expect(found?.occupiedBy).toBeNull()
            expect(found?.updatedAt).toBe('2026-11-12T12:00:00.000Z')
        })
    })

    describe('findAvailable', () => {
        beforeEach(async () => {
            await repo.save(buildTable({ id: 'free-2', number: 1, capacity: 2 }))
            await repo.save(buildTable({ id: 'free-6', number: 2, capacity: 6 }))
            await repo.save(buildTable({ id: 'free-4', number: 3, capacity: 4 }))
            await repo.save(buildTable({ id: 'res-c1', number: 4, capacity: 4 }))
            await repo.save(buildTable({ id: 'res-c2', number: 5, capacity: 4 }))
            await repo.save(buildTable({ id: 'res-none', number: 6, capacity: 4 }))
            await repo.save(buildTable({ id: 'occ-c1', number: 7, capacity: 4 }))
            await repo.save(buildTable({ id: 'occ-c2', number: 8, capacity: 4 }))
            await repo.save(buildTable({ id: 'occ-staff', number: 9, capacity: 4 }))
            await repo.save(buildTable({ id: 'other-rest', number: 1, capacity: 4, restaurantId: 'r2' }))
            await repo.updateStatus('res-c1', 'reservada', 'c1', NOW)
            await repo.updateStatus('res-c2', 'reservada', 'c2', NOW)
            await repo.updateStatus('res-none', 'reservada', null, NOW)
            await repo.updateStatus('occ-staff', 'ocupada', null, NOW)
            await db.run("UPDATE tables SET status = 'ocupada', occupied_by = 'c1' WHERE id = 'occ-c1'")
            await db.run("UPDATE tables SET status = 'ocupada', occupied_by = 'c2' WHERE id = 'occ-c2'")
        })

        it('should return free tables plus those reserved for or occupied by the user, with enough capacity, ordered by capacity and number', async () => {
            const tables = await repo.findAvailable('r1', 3, 'c1')
            expect(tables.map(t => t.id)).toEqual(['free-4', 'res-c1', 'occ-c1', 'free-6'])
        })

        it('should apply the capacity filter to reserved and occupied tables too', async () => {
            const tables = await repo.findAvailable('r1', 5, 'c1')
            expect(tables.map(t => t.id)).toEqual(['free-6'])
        })

        it('should return only free tables to a user without reservations', async () => {
            const tables = await repo.findAvailable('r1', 1, 'someone-else')
            expect(tables.map(t => t.id)).toEqual(['free-2', 'free-4', 'free-6'])
        })
    })

    describe('occupyIfAvailable', () => {
        it('should occupy a free table and record the occupant', async () => {
            await repo.save(buildTable({ capacity: 4 }))

            const ok = await repo.occupyIfAvailable('t1', 'r1', 2, 'c1', '2026-11-12T13:00:00.000Z')

            expect(ok).toBe(true)
            const found = await repo.findById('t1')
            expect(found?.status).toBe('ocupada')
            expect(found?.occupiedBy).toBe('c1')
            expect(found?.updatedAt).toBe('2026-11-12T13:00:00.000Z')
        })

        it('should be idempotent for the same user and reject another user', async () => {
            await repo.save(buildTable())

            expect(await repo.occupyIfAvailable('t1', 'r1', 2, 'c1', NOW)).toBe(true)
            expect(await repo.occupyIfAvailable('t1', 'r1', 2, 'c1', NOW)).toBe(true)
            expect(await repo.occupyIfAvailable('t1', 'r1', 2, 'c2', NOW)).toBe(false)
            expect((await repo.findById('t1'))?.occupiedBy).toBe('c1')
        })

        it('should occupy a table reserved for the user and clear the reservation', async () => {
            await repo.save(buildTable())
            await repo.updateStatus('t1', 'reservada', 'c1', NOW)

            expect(await repo.occupyIfAvailable('t1', 'r1', 2, 'c2', NOW)).toBe(false)
            expect(await repo.occupyIfAvailable('t1', 'r1', 2, 'c1', NOW)).toBe(true)

            const found = await repo.findById('t1')
            expect(found?.status).toBe('ocupada')
            expect(found?.reservedFor).toBeNull()
            expect(found?.reservedForEmail).toBeNull()
            expect(found?.occupiedBy).toBe('c1')
        })

        it('should not occupy a reservation without owner, a table occupied by staff, a table without capacity or of another restaurant', async () => {
            await repo.save(buildTable({ id: 'res-none', number: 1 }))
            await repo.save(buildTable({ id: 'staff', number: 2 }))
            await repo.save(buildTable({ id: 'small', number: 3, capacity: 2 }))
            await repo.updateStatus('res-none', 'reservada', null, NOW)
            await repo.updateStatus('staff', 'ocupada', null, NOW)

            expect(await repo.occupyIfAvailable('res-none', 'r1', 2, 'c1', NOW)).toBe(false)
            expect(await repo.occupyIfAvailable('staff', 'r1', 2, 'c1', NOW)).toBe(false)
            expect(await repo.occupyIfAvailable('small', 'r1', 3, 'c1', NOW)).toBe(false)
            expect(await repo.occupyIfAvailable('small', 'r2', 2, 'c1', NOW)).toBe(false)
            expect((await repo.findById('small'))?.status).toBe('libre')
        })
    })
})

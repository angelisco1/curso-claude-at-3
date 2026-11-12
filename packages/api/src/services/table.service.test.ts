import { describe, it, expect, beforeEach } from 'vitest'
import { TableService, type ClientFinder } from '@services/table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import { MockRestaurantRepository } from '@repositories/mocks/MockRestaurantRepository.js'
import {
    DuplicatedTableNumberError,
    InvalidPeopleCountError,
    InvalidReservationClientError,
    InvalidTableCapacityError,
    InvalidTableNumberError,
    InvalidTableStatusError,
    RestaurantNotFoundError,
    TableNotAvailableError,
    TableNotFoundError,
    TableOccupiedError
} from '@errors/DomainErrors.js'

const USERS = [
    { id: 'c1', email: 'cliente1@resttek.com', role: 'cliente' },
    { id: 'c2', email: 'cliente2@resttek.com', role: 'cliente' },
    { id: 'w1', email: 'camarero1@resttek.com', role: 'camarero' }
]

const clientFinder: ClientFinder = {
    async findByEmail(email: string) {
        return USERS.find(u => u.email === email.trim().toLowerCase()) ?? null
    }
}

describe('TableService', () => {
    let tableRepo: MockTableRepository
    let restaurantRepo: MockRestaurantRepository
    let service: TableService

    beforeEach(async () => {
        tableRepo = new MockTableRepository({ c1: 'cliente1@resttek.com', c2: 'cliente2@resttek.com' })
        restaurantRepo = new MockRestaurantRepository()
        for (const id of ['r1', 'r2']) {
            await restaurantRepo.save({
                id,
                name: `Rest ${id}`,
                address: 'Calle Mayor 10',
                email: `${id}@resttek.com`,
                phone: '+34 612345678',
                ownerFirstName: 'Carlos',
                ownerLastName: 'García',
                logoUrl: null,
                createdAt: '2026-11-12T10:00:00.000Z',
                updatedAt: '2026-11-12T10:00:00.000Z'
            })
        }
        service = new TableService(tableRepo, restaurantRepo, clientFinder)
    })

    describe('create', () => {
        it('should create a free table without reservation nor occupant', async () => {
            const table = await service.create('r1', { number: 1, description: '  Ventana  ', capacity: 4 })

            expect(table.id).toBeTruthy()
            expect(table).toMatchObject({
                restaurantId: 'r1',
                number: 1,
                description: 'Ventana',
                capacity: 4,
                status: 'libre',
                reservedFor: null,
                reservedForEmail: null,
                occupiedBy: null
            })
            expect(table.createdAt).toBe(table.updatedAt)
            expect(await tableRepo.findById(table.id)).not.toBeNull()
        })

        it.each([undefined, null, '', '   '])('should store description %j as null', async (description) => {
            const table = await service.create('r1', { number: 1, description: description as string | null, capacity: 2 })
            expect(table.description).toBeNull()
        })

        it('should throw RestaurantNotFoundError if the restaurant does not exist', async () => {
            await expect(service.create('nope', { number: 1, capacity: 2 })).rejects.toThrow(RestaurantNotFoundError)
        })

        it.each([0, -1, 1.5, '3', null, undefined])('should reject number %j', async (number) => {
            await expect(service.create('r1', { number: number as number, capacity: 2 })).rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, -2, 2.5, '4', null, undefined])('should reject capacity %j', async (capacity) => {
            await expect(service.create('r1', { number: 1, capacity: capacity as number })).rejects.toThrow(InvalidTableCapacityError)
        })

        it('should throw DuplicatedTableNumberError for a repeated number in the same restaurant', async () => {
            await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.create('r1', { number: 1, capacity: 4 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should allow the same number in another restaurant', async () => {
            await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.create('r2', { number: 1, capacity: 2 })).resolves.toBeDefined()
        })
    })

    describe('findByRestaurant / findById', () => {
        it('should list tables of the restaurant ordered by number, or [] if none', async () => {
            await service.create('r1', { number: 2, capacity: 2 })
            await service.create('r1', { number: 1, capacity: 2 })
            await service.create('r2', { number: 1, capacity: 2 })

            expect((await service.findByRestaurant('r1')).map(t => t.number)).toEqual([1, 2])
            expect(await service.findByRestaurant('nope')).toEqual([])
        })

        it('should find a table of the restaurant', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            expect((await service.findById('r1', created.id)).id).toBe(created.id)
        })

        it('should throw TableNotFoundError if it does not exist or belongs to another restaurant', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.findById('r1', 'nope')).rejects.toThrow(TableNotFoundError)
            await expect(service.findById('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('update', () => {
        it('should update number, description and capacity keeping status and createdAt', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await service.updateStatus('r1', created.id, 'reservada', 'cliente1@resttek.com')

            const updated = await service.update('r1', created.id, { number: 5, description: ' Terraza ', capacity: 6 })

            expect(updated).toMatchObject({
                id: created.id,
                number: 5,
                description: 'Terraza',
                capacity: 6,
                status: 'reservada',
                reservedFor: 'c1',
                createdAt: created.createdAt
            })
            expect(await service.findById('r1', created.id)).toMatchObject({ number: 5, capacity: 6, status: 'reservada' })
        })

        it('should validate number and capacity', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.update('r1', created.id, { number: 0, capacity: 2 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('r1', created.id, { number: 1, capacity: 0 })).rejects.toThrow(InvalidTableCapacityError)
        })

        it('should allow keeping its own number but reject the number of another table', async () => {
            const t1 = await service.create('r1', { number: 1, capacity: 2 })
            await service.create('r1', { number: 2, capacity: 2 })

            await expect(service.update('r1', t1.id, { number: 1, capacity: 4 })).resolves.toBeDefined()
            await expect(service.update('r1', t1.id, { number: 2, capacity: 4 })).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.update('r2', created.id, { number: 1, capacity: 2 })).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it('should delete a free or reserved table', async () => {
            const free = await service.create('r1', { number: 1, capacity: 2 })
            const reserved = await service.create('r1', { number: 2, capacity: 2 })
            await service.updateStatus('r1', reserved.id, 'reservada', null)

            await service.delete('r1', free.id)
            await service.delete('r1', reserved.id)

            expect(await service.findByRestaurant('r1')).toEqual([])
        })

        it('should throw TableOccupiedError for an occupied table', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await service.updateStatus('r1', created.id, 'ocupada', null)

            await expect(service.delete('r1', created.id)).rejects.toThrow(TableOccupiedError)
            expect(await tableRepo.findById(created.id)).not.toBeNull()
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.delete('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('updateStatus', () => {
        it('should normalize the status and return the full table', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            const updated = await service.updateStatus('r1', created.id, '  OCUPADA ')
            expect(updated.status).toBe('ocupada')
            expect(updated.occupiedBy).toBeNull()
        })

        it('should throw InvalidTableStatusError for an invalid status', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.updateStatus('r1', created.id, 'cerrada')).rejects.toThrow(InvalidTableStatusError)
        })

        it('should reserve for a client resolving the email to its id', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            const updated = await service.updateStatus('r1', created.id, 'reservada', ' Cliente1@resttek.com ')
            expect(updated.reservedFor).toBe('c1')
            expect(updated.reservedForEmail).toBe('cliente1@resttek.com')
        })

        it('should create a reservation without owner when no email is given', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            const updated = await service.updateStatus('r1', created.id, 'reservada')
            expect(updated.status).toBe('reservada')
            expect(updated.reservedFor).toBeNull()
        })

        it.each(['nadie@resttek.com', 'camarero1@resttek.com'])('should throw InvalidReservationClientError for %s', async (email) => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.updateStatus('r1', created.id, 'reservada', email)).rejects.toThrow(InvalidReservationClientError)
        })

        it('should ignore reservedForEmail and clear reservation and occupant for libre and ocupada', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await service.occupy('r1', created.id, 2, 'c1')

            const freed = await service.updateStatus('r1', created.id, 'libre', 'cliente1@resttek.com')
            expect(freed).toMatchObject({ status: 'libre', reservedFor: null, occupiedBy: null })

            await service.updateStatus('r1', created.id, 'reservada', 'cliente1@resttek.com')
            const seated = await service.updateStatus('r1', created.id, 'ocupada', 'cliente1@resttek.com')
            expect(seated).toMatchObject({ status: 'ocupada', reservedFor: null, reservedForEmail: null, occupiedBy: null })
        })

        it('should allow freeing an occupied table and any transition, including to the same status', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            for (const status of ['ocupada', 'ocupada', 'reservada', 'libre', 'libre', 'reservada', 'ocupada', 'libre']) {
                await expect(service.updateStatus('r1', created.id, status)).resolves.toMatchObject({ status })
            }
        })

        it('should throw TableNotFoundError for a table of another restaurant', async () => {
            const created = await service.create('r1', { number: 1, capacity: 2 })
            await expect(service.updateStatus('r2', created.id, 'libre')).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findAvailable', () => {
        it.each([0, -1, 1.5, NaN, undefined])('should throw InvalidPeopleCountError for people %j', async (people) => {
            await expect(service.findAvailable('r1', people as number, 'c1')).rejects.toThrow(InvalidPeopleCountError)
        })

        it('should return available tables with reservedForMe and occupiedByMe flags', async () => {
            const free = await service.create('r1', { number: 1, capacity: 4 })
            const reserved = await service.create('r1', { number: 2, capacity: 4 })
            const occupied = await service.create('r1', { number: 3, capacity: 4 })
            const reservedOther = await service.create('r1', { number: 4, capacity: 4 })
            await service.updateStatus('r1', reserved.id, 'reservada', 'cliente1@resttek.com')
            await service.updateStatus('r1', reservedOther.id, 'reservada', 'cliente2@resttek.com')
            await service.occupy('r1', occupied.id, 2, 'c1')

            const tables = await service.findAvailable('r1', 2, 'c1')

            expect(tables.map(t => [t.id, t.reservedForMe, t.occupiedByMe])).toEqual([
                [free.id, false, false],
                [reserved.id, true, false],
                [occupied.id, false, true]
            ])
        })

        it('should return [] when nothing fits', async () => {
            await service.create('r1', { number: 1, capacity: 2 })
            expect(await service.findAvailable('r1', 3, 'c1')).toEqual([])
        })
    })

    describe('occupy', () => {
        it('should occupy a free table for the user', async () => {
            const created = await service.create('r1', { number: 1, capacity: 4 })
            const table = await service.occupy('r1', created.id, 3, 'c1')
            expect(table).toMatchObject({ id: created.id, status: 'ocupada', occupiedBy: 'c1', reservedFor: null })
        })

        it('should be idempotent for the same user and reject another user with TableNotAvailableError', async () => {
            const created = await service.create('r1', { number: 1, capacity: 4 })
            await service.occupy('r1', created.id, 2, 'c1')

            await expect(service.occupy('r1', created.id, 2, 'c1')).resolves.toMatchObject({ occupiedBy: 'c1' })
            await expect(service.occupy('r1', created.id, 2, 'c2')).rejects.toThrow(TableNotAvailableError)
        })

        it('should occupy a table reserved for the user but not one reserved for someone else or without owner', async () => {
            const mine = await service.create('r1', { number: 1, capacity: 4 })
            const other = await service.create('r1', { number: 2, capacity: 4 })
            const phone = await service.create('r1', { number: 3, capacity: 4 })
            await service.updateStatus('r1', mine.id, 'reservada', 'cliente1@resttek.com')
            await service.updateStatus('r1', other.id, 'reservada', 'cliente2@resttek.com')
            await service.updateStatus('r1', phone.id, 'reservada')

            await expect(service.occupy('r1', mine.id, 2, 'c1')).resolves.toMatchObject({ status: 'ocupada', reservedFor: null, reservedForEmail: null })
            await expect(service.occupy('r1', other.id, 2, 'c1')).rejects.toThrow(TableNotAvailableError)
            await expect(service.occupy('r1', phone.id, 2, 'c1')).rejects.toThrow(TableNotAvailableError)
        })

        it('should reject when capacity is not enough or a staff member seated it', async () => {
            const small = await service.create('r1', { number: 1, capacity: 2 })
            const staff = await service.create('r1', { number: 2, capacity: 4 })
            await service.updateStatus('r1', staff.id, 'ocupada')

            await expect(service.occupy('r1', small.id, 3, 'c1')).rejects.toThrow(TableNotAvailableError)
            await expect(service.occupy('r1', staff.id, 2, 'c1')).rejects.toThrow(TableNotAvailableError)
        })

        it('should throw TableNotFoundError if it does not exist or belongs to another restaurant', async () => {
            const created = await service.create('r1', { number: 1, capacity: 4 })
            await expect(service.occupy('r1', 'nope', 2, 'c1')).rejects.toThrow(TableNotFoundError)
            await expect(service.occupy('r2', created.id, 2, 'c1')).rejects.toThrow(TableNotFoundError)
        })

        it('should throw InvalidPeopleCountError before touching the table', async () => {
            const created = await service.create('r1', { number: 1, capacity: 4 })
            await expect(service.occupy('r1', created.id, 0, 'c1')).rejects.toThrow(InvalidPeopleCountError)
            expect((await service.findById('r1', created.id)).status).toBe('libre')
        })
    })
})

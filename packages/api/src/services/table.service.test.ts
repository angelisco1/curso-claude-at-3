import { describe, it, expect, beforeEach } from 'vitest'
import { TableService } from './table.service.js'
import { MockTableRepository } from '@repositories/mocks/MockTableRepository.js'
import {
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidTableStatusError,
    DuplicatedTableNumberError,
    TableNotFoundError,
    TableOccupiedError,
    InvalidPeopleCountError
} from '@errors/DomainErrors.js'

describe('TableService', () => {
    let repo: MockTableRepository
    let service: TableService

    const validInput = { number: 1, capacity: 4, description: 'Ventana' }

    beforeEach(() => {
        repo = new MockTableRepository()
        service = new TableService(repo)
    })

    describe('create', () => {
        it('crea una mesa libre, sin reserva, y la guarda', async () => {
            const table = await service.create('r1', validInput)

            expect(table).toMatchObject({
                restaurantId: 'r1',
                number: 1,
                capacity: 4,
                description: 'Ventana',
                status: 'libre',
                reservedFor: null
            })
            expect(table.id).toBeDefined()
            expect(table.createdAt).toBe(table.updatedAt)
            expect(await repo.findById(table.id)).toEqual(table)
        })

        it('acepta un estado inicial y lo normaliza', async () => {
            const table = await service.create('r1', { ...validInput, status: ' Reservada ' })
            expect(table.status).toBe('reservada')
            expect(table.reservedFor).toBeNull()
        })

        it('lanza InvalidTableStatusError con un estado inválido', async () => {
            await expect(service.create('r1', { ...validInput, status: 'cerrada' })).rejects.toThrow(InvalidTableStatusError)
        })

        it('aplica trim a la descripción', async () => {
            const table = await service.create('r1', { ...validInput, description: '  Terraza  ' })
            expect(table.description).toBe('Terraza')
        })

        it.each([undefined, null, '', '   '])('guarda la descripción %j como null', async (description) => {
            const table = await service.create('r1', { ...validInput, description })
            expect(table.description).toBeNull()
        })

        it.each([0, -1, 1.5, '3', undefined, null, NaN])('lanza InvalidTableNumberError con number = %j', async (number) => {
            await expect(service.create('r1', { ...validInput, number: number as number }))
                .rejects.toThrow(InvalidTableNumberError)
        })

        it.each([0, -2, 2.5, '4', undefined, null])('lanza InvalidTableCapacityError con capacity = %j', async (capacity) => {
            await expect(service.create('r1', { ...validInput, capacity: capacity as number }))
                .rejects.toThrow(InvalidTableCapacityError)
        })

        it('lanza DuplicatedTableNumberError si el número ya existe en el restaurante', async () => {
            await service.create('r1', validInput)
            await expect(service.create('r1', validInput)).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('permite el mismo número en otro restaurante', async () => {
            await service.create('r1', validInput)
            await expect(service.create('r2', validInput)).resolves.toMatchObject({ restaurantId: 'r2', number: 1 })
        })
    })

    describe('update', () => {
        it('reemplaza número, capacidad y descripción y conserva id, restaurante y createdAt', async () => {
            const created = await service.create('r1', validInput)

            const updated = await service.update('r1', created.id, { number: 5, capacity: 6 })

            expect(updated).toMatchObject({
                id: created.id,
                restaurantId: 'r1',
                number: 5,
                capacity: 6,
                description: null,
                status: 'libre',
                createdAt: created.createdAt
            })
            expect(await repo.findById(created.id)).toEqual(updated)
        })

        it('permite mantener el número de la propia mesa', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.update('r1', created.id, { ...validInput, capacity: 2 })).resolves.toMatchObject({ number: 1, capacity: 2 })
        })

        it('lanza DuplicatedTableNumberError si el número es de otra mesa del restaurante', async () => {
            await service.create('r1', validInput)
            const other = await service.create('r1', { ...validInput, number: 2 })
            await expect(service.update('r1', other.id, validInput)).rejects.toThrow(DuplicatedTableNumberError)
        })

        it('conserva el estado y la reserva si no se envía status', async () => {
            const created = await service.create('r1', validInput)
            await repo.updateStatus(created.id, 'reservada', 'c1', created.updatedAt)

            const updated = await service.update('r1', created.id, { ...validInput, capacity: 6 })
            expect(updated).toMatchObject({ status: 'reservada', reservedFor: 'c1' })
        })

        it('conserva la reserva si el status enviado no cambia', async () => {
            const created = await service.create('r1', validInput)
            await repo.updateStatus(created.id, 'reservada', 'c1', created.updatedAt)

            const updated = await service.update('r1', created.id, { ...validInput, status: 'reservada' })
            expect(updated).toMatchObject({ status: 'reservada', reservedFor: 'c1' })
        })

        it('limpia la reserva si el status cambia', async () => {
            const created = await service.create('r1', validInput)
            await repo.updateStatus(created.id, 'reservada', 'c1', created.updatedAt)

            const updated = await service.update('r1', created.id, { ...validInput, status: 'libre' })
            expect(updated).toMatchObject({ status: 'libre', reservedFor: null })
        })

        it('valida número y capacidad', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.update('r1', created.id, { ...validInput, number: 0 })).rejects.toThrow(InvalidTableNumberError)
            await expect(service.update('r1', created.id, { ...validInput, capacity: 0 })).rejects.toThrow(InvalidTableCapacityError)
        })

        it('lanza TableNotFoundError si la mesa no existe o es de otro restaurante', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.update('r1', 'no-existe', validInput)).rejects.toThrow(TableNotFoundError)
            await expect(service.update('r2', created.id, validInput)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('findByRestaurant', () => {
        it('devuelve solo las mesas del restaurante ordenadas por número', async () => {
            await service.create('r1', { ...validInput, number: 3 })
            await service.create('r1', { ...validInput, number: 1 })
            await service.create('r2', { ...validInput, number: 2 })

            const tables = await service.findByRestaurant('r1')
            expect(tables.map(t => t.number)).toEqual([1, 3])
        })
    })

    describe('findById', () => {
        it('devuelve la mesa del restaurante', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.findById('r1', created.id)).resolves.toEqual(created)
        })

        it('lanza TableNotFoundError si no existe o es de otro restaurante', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.findById('r1', 'no-existe')).rejects.toThrow(TableNotFoundError)
            await expect(service.findById('r2', created.id)).rejects.toThrow(TableNotFoundError)
        })
    })

    describe('delete', () => {
        it.each(['libre', 'reservada'])('borra una mesa %s', async (status) => {
            const created = await service.create('r1', { ...validInput, status })
            await service.delete('r1', created.id)
            expect(await repo.findById(created.id)).toBeNull()
        })

        it('lanza TableOccupiedError y no borra si la mesa está ocupada', async () => {
            const created = await service.create('r1', { ...validInput, status: 'ocupada' })
            await expect(service.delete('r1', created.id)).rejects.toThrow(TableOccupiedError)
            expect(await repo.findById(created.id)).not.toBeNull()
        })

        it('lanza TableNotFoundError si no existe o es de otro restaurante', async () => {
            const created = await service.create('r1', validInput)
            await expect(service.delete('r1', 'no-existe')).rejects.toThrow(TableNotFoundError)
            await expect(service.delete('r2', created.id)).rejects.toThrow(TableNotFoundError)
            expect(await repo.findById(created.id)).not.toBeNull()
        })
    })

    describe('findAvailable', () => {
        beforeEach(async () => {
            await service.create('r1', { number: 1, capacity: 2 })
            await service.create('r1', { number: 2, capacity: 6 })
            await service.create('r1', { number: 3, capacity: 4, status: 'ocupada' })
            const mine = await service.create('r1', { number: 4, capacity: 4 })
            await repo.updateStatus(mine.id, 'reservada', 'c1', mine.updatedAt)
            const other = await service.create('r1', { number: 5, capacity: 4 })
            await repo.updateStatus(other.id, 'reservada', 'c2', other.updatedAt)
            await service.create('r2', { number: 1, capacity: 8 })
        })

        it('devuelve libres y reservadas para el usuario con capacidad suficiente', async () => {
            const tables = await service.findAvailable('r1', 3, 'c1')
            expect(tables.map(t => t.number)).toEqual([4, 2])
        })

        it('devuelve [] si no hay ninguna', async () => {
            await expect(service.findAvailable('r1', 10, 'c1')).resolves.toEqual([])
        })

        it.each([0, -1, 1.5, NaN, '3', undefined, null])('lanza InvalidPeopleCountError con people = %j', async (people) => {
            await expect(service.findAvailable('r1', people as number, 'c1')).rejects.toThrow(InvalidPeopleCountError)
        })
    })
})

import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { SqliteDiscountRepository } from './discount.repository.js'
import { Database } from '@config/database.js'
import type { Discount } from '@models/discount.model.js'

const NOW = '2026-11-12T10:00:00.000Z'

describe('SqliteDiscountRepository (Integration)', () => {
    let db: Database
    let repo: SqliteDiscountRepository

    const discount: Discount = { id: 'd1', code: 'DISCOUNT30', percentage: 30, active: true, createdAt: NOW, updatedAt: NOW }

    beforeAll(async () => {
        process.env.NODE_ENV = 'test'
        db = new Database()
        await db.initialize()
        repo = new SqliteDiscountRepository(db)
    })

    afterAll(async () => {
        await db.close()
    })

    it('should save and find a discount by id and by code', async () => {
        await repo.save(discount)

        expect(await repo.findById('d1')).toEqual(discount)
        expect(await repo.findByCode('DISCOUNT30')).toEqual(discount)
        expect(await repo.findByCode('NOPE')).toBeNull()
        expect(await repo.findById('nope')).toBeNull()
    })

    it('should update an existing discount', async () => {
        await repo.save({ ...discount, percentage: 25, active: false, updatedAt: '2026-11-12T12:00:00.000Z' })

        expect(await repo.findById('d1')).toEqual({ ...discount, percentage: 25, active: false, updatedAt: '2026-11-12T12:00:00.000Z' })
    })

    it('should list discounts sorted by code and filter by active', async () => {
        await repo.save({ id: 'd2', code: 'ALFA', percentage: 10, active: true, createdAt: NOW, updatedAt: NOW })

        expect((await repo.findAll()).map(d => d.code)).toEqual(['ALFA', 'DISCOUNT30'])
        expect((await repo.findAll({ active: true })).map(d => d.code)).toEqual(['ALFA'])
        expect((await repo.findAll({ active: false })).map(d => d.code)).toEqual(['DISCOUNT30'])
    })

    it('should enforce the unique code at database level', async () => {
        await expect(repo.save({ id: 'd3', code: 'ALFA', percentage: 5, active: true, createdAt: NOW, updatedAt: NOW })).rejects.toThrow()
    })

    it('should delete a discount', async () => {
        await repo.delete('d2')
        expect(await repo.findById('d2')).toBeNull()
    })
})

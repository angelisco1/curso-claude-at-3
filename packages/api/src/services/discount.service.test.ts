import { describe, it, expect, beforeEach } from 'vitest'
import { DiscountService } from './discount.service.js'
import { MockDiscountRepository } from '@repositories/mocks/MockDiscountRepository.js'
import {
    DiscountNotFoundError,
    DuplicatedDiscountCodeError,
    InvalidDiscountActiveError,
    InvalidDiscountCodeError,
    InvalidDiscountPercentageError
} from '@errors/DomainErrors.js'

describe('DiscountService', () => {
    let repo: MockDiscountRepository
    let service: DiscountService

    beforeEach(() => {
        repo = new MockDiscountRepository()
        service = new DiscountService(repo)
    })

    describe('create', () => {
        it('should create an active discount with a normalized code', async () => {
            const discount = await service.create({ code: ' black_friday ', percentage: 50 })

            expect(discount).toEqual({
                id: expect.any(String),
                code: 'BLACK_FRIDAY',
                percentage: 50,
                active: true,
                createdAt: expect.any(String),
                updatedAt: expect.any(String)
            })
            expect(await repo.findById(discount.id)).toEqual(discount)
        })

        it('should allow creating an inactive discount', async () => {
            const discount = await service.create({ code: 'DISCOUNT30', percentage: 30, active: false })
            expect(discount.active).toBe(false)
        })

        it('should reject an invalid code', async () => {
            await expect(service.create({ code: 'X', percentage: 10 })).rejects.toThrow(InvalidDiscountCodeError)
        })

        it.each([0, 101, -5, 12.5, '30', null, undefined, NaN])('should reject percentage %s', async (percentage) => {
            await expect(service.create({ code: 'DISCOUNT30', percentage: percentage as unknown as number }))
                .rejects.toThrow(InvalidDiscountPercentageError)
        })

        it.each([1, 100])('should accept the boundary percentage %s', async (percentage) => {
            const discount = await service.create({ code: `CODE${percentage}`, percentage })
            expect(discount.percentage).toBe(percentage)
        })

        it('should reject a non boolean active', async () => {
            await expect(service.create({ code: 'DISCOUNT30', percentage: 30, active: 'yes' as unknown as boolean }))
                .rejects.toThrow(InvalidDiscountActiveError)
        })

        it('should reject a duplicated code, case-insensitively', async () => {
            await service.create({ code: 'DISCOUNT30', percentage: 30 })
            await expect(service.create({ code: 'discount30', percentage: 10 })).rejects.toThrow(DuplicatedDiscountCodeError)
        })
    })

    describe('update', () => {
        it('should change the percentage and the active flag, keeping the code', async () => {
            const created = await service.create({ code: 'DISCOUNT30', percentage: 30 })

            const updated = await service.update(created.id, { percentage: 25, active: false })

            expect(updated).toMatchObject({ id: created.id, code: 'DISCOUNT30', percentage: 25, active: false, createdAt: created.createdAt })
            expect(await repo.findById(created.id)).toEqual(updated)
        })

        it('should keep omitted fields', async () => {
            const created = await service.create({ code: 'DISCOUNT30', percentage: 30 })
            const updated = await service.update(created.id, { active: false })
            expect(updated.percentage).toBe(30)
        })

        it('should validate the new values', async () => {
            const created = await service.create({ code: 'DISCOUNT30', percentage: 30 })
            await expect(service.update(created.id, { percentage: 0 })).rejects.toThrow(InvalidDiscountPercentageError)
            await expect(service.update(created.id, { active: 1 as unknown as boolean })).rejects.toThrow(InvalidDiscountActiveError)
        })

        it('should throw DiscountNotFoundError for an unknown id', async () => {
            await expect(service.update('nope', { active: false })).rejects.toThrow(DiscountNotFoundError)
        })
    })

    describe('queries and delete', () => {
        it('should get by id or throw DiscountNotFoundError', async () => {
            const created = await service.create({ code: 'DISCOUNT30', percentage: 30 })
            expect(await service.getById(created.id)).toEqual(created)
            await expect(service.getById('nope')).rejects.toThrow(DiscountNotFoundError)
        })

        it('should list all discounts sorted by code and filter by active', async () => {
            await service.create({ code: 'ZETA', percentage: 5 })
            await service.create({ code: 'ALFA', percentage: 10, active: false })

            expect((await service.getAll()).map(d => d.code)).toEqual(['ALFA', 'ZETA'])
            expect((await service.getAll({ active: true })).map(d => d.code)).toEqual(['ZETA'])
            expect((await service.getAll({ active: false })).map(d => d.code)).toEqual(['ALFA'])
        })

        it('should delete a discount or throw DiscountNotFoundError', async () => {
            const created = await service.create({ code: 'DISCOUNT30', percentage: 30 })
            await service.delete(created.id)
            expect(await repo.findById(created.id)).toBeNull()
            await expect(service.delete(created.id)).rejects.toThrow(DiscountNotFoundError)
        })
    })
})

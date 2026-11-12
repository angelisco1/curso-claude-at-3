import { describe, it, expect, vi } from 'vitest'
import type { Request, Response } from 'express'
import { errorHandler } from '@shared/infrastructure/http/errorHandler.js'
import {
    TableNotFoundError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    TableOccupiedError,
    InvalidTableNumberError,
    InvalidReservationClientError
} from '@errors/DomainErrors.js'

function run(error: unknown) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() } as unknown as Response
    errorHandler(error, {} as Request, res, vi.fn())
    return res as unknown as { status: ReturnType<typeof vi.fn>; json: ReturnType<typeof vi.fn> }
}

describe('errorHandler (mesas)', () => {
    it('should map TableNotFoundError to 404', () => {
        const res = run(new TableNotFoundError())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'TableNotFoundError', message: 'Table not found' })
    })

    it.each([
        new DuplicatedTableNumberError(),
        new TableNotAvailableError(),
        new TableOccupiedError()
    ])('should map $name to 409', (error) => {
        const res = run(error)
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith({ error: error.name, message: error.message })
    })

    it.each([
        new InvalidTableNumberError(),
        new InvalidReservationClientError()
    ])('should map $name to 400', (error) => {
        const res = run(error)
        expect(res.status).toHaveBeenCalledWith(400)
    })
})

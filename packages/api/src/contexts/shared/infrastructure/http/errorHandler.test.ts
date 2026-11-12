import { describe, it, expect, vi } from 'vitest'
import type { Request, Response, NextFunction } from 'express'
import { errorHandler } from './errorHandler.js'
import {
    TableNotFoundError,
    DuplicatedTableNumberError,
    TableNotAvailableError,
    TableOccupiedError,
    InvalidTableStatusError,
    InvalidTableNumberError,
    InvalidTableCapacityError,
    InvalidPeopleCountError,
    InvalidReservedForError
} from '@errors/DomainErrors.js'

function run(err: unknown) {
    const res = {
        status: vi.fn().mockReturnThis(),
        json: vi.fn().mockReturnThis()
    } as unknown as Response
    errorHandler(err, {} as Request, res, (() => {}) as NextFunction)
    return res as unknown as { status: ReturnType<typeof vi.fn>, json: ReturnType<typeof vi.fn> }
}

describe('errorHandler - errores de mesas', () => {
    it('responde 404 con TableNotFoundError', () => {
        const res = run(new TableNotFoundError())
        expect(res.status).toHaveBeenCalledWith(404)
        expect(res.json).toHaveBeenCalledWith({ error: 'TableNotFoundError', message: 'Table not found' })
    })

    it.each([
        [new DuplicatedTableNumberError(), 'DuplicatedTableNumberError'],
        [new TableNotAvailableError(), 'TableNotAvailableError'],
        [new TableOccupiedError(), 'TableOccupiedError']
    ])('responde 409 con %s', (err, name) => {
        const res = run(err)
        expect(res.status).toHaveBeenCalledWith(409)
        expect(res.json).toHaveBeenCalledWith(expect.objectContaining({ error: name }))
    })

    it.each([
        new InvalidTableStatusError(),
        new InvalidTableNumberError(),
        new InvalidTableCapacityError(),
        new InvalidPeopleCountError(),
        new InvalidReservedForError()
    ])('responde 400 con errores de validación (%s)', (err) => {
        const res = run(err)
        expect(res.status).toHaveBeenCalledWith(400)
        expect(res.json).toHaveBeenCalledWith({ error: err.name, message: err.message })
    })
})

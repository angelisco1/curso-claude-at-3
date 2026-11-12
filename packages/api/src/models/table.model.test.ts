import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from '@models/table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it('should accept all valid statuses', () => {
        for (const status of ['libre', 'ocupada', 'reservada']) {
            expect(normalizeTableStatus(status)).toBe(status)
        }
    })

    it('should normalize case and surrounding spaces', () => {
        expect(normalizeTableStatus('  OCUPADA ')).toBe('ocupada')
        expect(normalizeTableStatus('Reservada')).toBe('reservada')
    })

    it('should throw InvalidTableStatusError for an unknown status', () => {
        expect(() => normalizeTableStatus('cerrada')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('cerrada')).toThrow('Estado inválido: cerrada. Debe ser uno de: libre, ocupada, reservada')
    })

    it('should throw InvalidTableStatusError for empty or non-string values', () => {
        expect(() => normalizeTableStatus('')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(InvalidTableStatusError)
    })
})

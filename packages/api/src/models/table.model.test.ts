import { describe, it, expect } from 'vitest'
import { normalizeTableStatus } from './table.model.js'
import { InvalidTableStatusError } from '@errors/DomainErrors.js'

describe('normalizeTableStatus', () => {
    it.each(['libre', 'ocupada', 'reservada'])('acepta el estado válido %s', (status) => {
        expect(normalizeTableStatus(status)).toBe(status)
    })

    it('normaliza mayúsculas y espacios', () => {
        expect(normalizeTableStatus('  OCUPADA ')).toBe('ocupada')
        expect(normalizeTableStatus('Reservada')).toBe('reservada')
    })

    it('lanza InvalidTableStatusError con un estado desconocido', () => {
        expect(() => normalizeTableStatus('cerrada')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus('cerrada')).toThrow('Estado inválido: cerrada. Debe ser uno de: libre, ocupada, reservada')
    })

    it('lanza InvalidTableStatusError si no es un texto', () => {
        expect(() => normalizeTableStatus('')).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(undefined as unknown as string)).toThrow(InvalidTableStatusError)
        expect(() => normalizeTableStatus(3 as unknown as string)).toThrow(InvalidTableStatusError)
    })
})

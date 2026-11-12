import { describe, it, expect } from 'vitest'
import { normalizeDiscountCode } from './discount.model.js'
import { InvalidDiscountCodeError } from '@errors/DomainErrors.js'

describe('normalizeDiscountCode', () => {
    it('should accept valid codes', () => {
        expect(normalizeDiscountCode('DISCOUNT30')).toBe('DISCOUNT30')
        expect(normalizeDiscountCode('BLACK_FRIDAY')).toBe('BLACK_FRIDAY')
        expect(normalizeDiscountCode('SUMMER-2026')).toBe('SUMMER-2026')
    })

    it('should trim and uppercase the code', () => {
        expect(normalizeDiscountCode('  black_friday ')).toBe('BLACK_FRIDAY')
    })

    it.each([undefined, null, '', '   ', 42, 'AB', 'A'.repeat(31), 'CON ESPACIO', 'DESCUENTO€', 'AÑO'])(
        'should throw InvalidDiscountCodeError for %s',
        (value) => {
            expect(() => normalizeDiscountCode(value as unknown as string)).toThrow(InvalidDiscountCodeError)
        }
    )
})

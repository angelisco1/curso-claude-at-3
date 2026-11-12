import { InvalidDiscountCodeError } from '@errors/DomainErrors.js'

const DISCOUNT_CODE_REGEX = /^[A-Z0-9_-]{3,30}$/

export interface Discount {
    id: string
    code: string
    percentage: number
    active: boolean
    createdAt: string
    updatedAt: string
}

export function normalizeDiscountCode(value: string): string {
    if (!value || typeof value !== 'string') {
        throw new InvalidDiscountCodeError()
    }

    const normalized = value.trim().toUpperCase()
    if (!DISCOUNT_CODE_REGEX.test(normalized)) {
        throw new InvalidDiscountCodeError()
    }
    return normalized
}

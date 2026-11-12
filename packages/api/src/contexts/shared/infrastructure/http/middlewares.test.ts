import { describe, it, expect, vi } from 'vitest'
import type { Response } from 'express'
import { authorizeRestaurant, type AuthRequest } from '@shared/infrastructure/http/middlewares.js'

function run(user: { role: string; restaurantId: string | null } | undefined, restaurantId = 'rest-1') {
    const req = { user, params: { restaurantId } } as unknown as AuthRequest
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() }
    const next = vi.fn()
    authorizeRestaurant(req, res as unknown as Response, next)
    return { res, next }
}

describe('authorizeRestaurant', () => {
    it.each(['manager', 'camarero', 'cocinero'])('should let a %s of the same restaurant pass', (role) => {
        const { next, res } = run({ role, restaurantId: 'rest-1' })
        expect(next).toHaveBeenCalled()
        expect(res.status).not.toHaveBeenCalled()
    })

    it.each(['manager', 'camarero', 'cocinero'])('should reject a %s of another restaurant with 403', (role) => {
        const { next, res } = run({ role, restaurantId: 'rest-2' })
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
        expect(res.json).toHaveBeenCalledWith({ error: 'Forbidden: Restaurant access denied' })
    })

    it('should reject an employee without restaurant', () => {
        const { res } = run({ role: 'camarero', restaurantId: null })
        expect(res.status).toHaveBeenCalledWith(403)
    })

    it.each(['admin', 'cliente'])('should not restrict %s', (role) => {
        const { next } = run({ role, restaurantId: null })
        expect(next).toHaveBeenCalled()
    })

    it('should reject a request without user', () => {
        const { res, next } = run(undefined)
        expect(next).not.toHaveBeenCalled()
        expect(res.status).toHaveBeenCalledWith(403)
    })
})

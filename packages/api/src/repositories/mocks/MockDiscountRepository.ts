import type { DiscountFilter, DiscountRepository } from '@repositories/discount.repository.js'
import type { Discount } from '@models/discount.model.js'

export class MockDiscountRepository implements DiscountRepository {
    private discounts: Map<string, Discount> = new Map()

    async findById(id: string): Promise<Discount | null> {
        return this.discounts.get(id) ?? null
    }

    async findByCode(code: string): Promise<Discount | null> {
        return Array.from(this.discounts.values()).find(d => d.code === code) ?? null
    }

    async findAll(filter: DiscountFilter = {}): Promise<Discount[]> {
        return Array.from(this.discounts.values())
            .filter(d => filter.active === undefined || d.active === filter.active)
            .sort((a, b) => a.code.localeCompare(b.code))
    }

    async save(discount: Discount): Promise<void> {
        this.discounts.set(discount.id, discount)
    }

    async delete(id: string): Promise<void> {
        this.discounts.delete(id)
    }
}

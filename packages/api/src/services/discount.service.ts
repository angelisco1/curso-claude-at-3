import { randomUUID } from 'crypto'
import type { Discount } from '@models/discount.model.js'
import { normalizeDiscountCode } from '@models/discount.model.js'
import type { DiscountFilter, DiscountRepository } from '@repositories/discount.repository.js'
import {
    DiscountNotFoundError,
    DuplicatedDiscountCodeError,
    InvalidDiscountActiveError,
    InvalidDiscountPercentageError
} from '@errors/DomainErrors.js'

export interface CreateDiscountDTO {
    code: string
    percentage: number
    active?: boolean
}

// El código es inmutable: solo se pueden cambiar el porcentaje y el estado
export interface UpdateDiscountDTO {
    percentage?: number
    active?: boolean
}

export class DiscountService {
    constructor(private readonly discountRepository: DiscountRepository) {}

    async create(dto: CreateDiscountDTO): Promise<Discount> {
        const now = new Date().toISOString()
        const discount = this.buildDiscount({
            id: randomUUID(),
            code: normalizeDiscountCode(dto.code),
            percentage: dto.percentage,
            active: dto.active ?? true,
            createdAt: now,
            updatedAt: now
        })

        if (await this.discountRepository.findByCode(discount.code)) {
            throw new DuplicatedDiscountCodeError()
        }

        await this.discountRepository.save(discount)
        return discount
    }

    async update(id: string, dto: UpdateDiscountDTO): Promise<Discount> {
        const existing = await this.getById(id)

        const updated = this.buildDiscount({
            ...existing,
            percentage: dto.percentage ?? existing.percentage,
            active: dto.active ?? existing.active,
            updatedAt: new Date().toISOString()
        })

        await this.discountRepository.save(updated)
        return updated
    }

    async delete(id: string): Promise<void> {
        await this.getById(id)
        await this.discountRepository.delete(id)
    }

    async getById(id: string): Promise<Discount> {
        const discount = await this.discountRepository.findById(id)
        if (!discount) {
            throw new DiscountNotFoundError()
        }
        return discount
    }

    async getAll(filter: DiscountFilter = {}): Promise<Discount[]> {
        return this.discountRepository.findAll(filter)
    }

    private buildDiscount(props: Discount): Discount {
        if (typeof props.percentage !== 'number' || !Number.isInteger(props.percentage) || props.percentage < 1 || props.percentage > 100) {
            throw new InvalidDiscountPercentageError()
        }
        if (typeof props.active !== 'boolean') {
            throw new InvalidDiscountActiveError()
        }

        return {
            id: props.id,
            code: props.code,
            percentage: props.percentage,
            active: props.active,
            createdAt: props.createdAt,
            updatedAt: props.updatedAt
        }
    }
}

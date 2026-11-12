import type { Request, Response, NextFunction } from 'express'
import type { DiscountService } from '@services/discount.service.js'
import type { Discount } from '@models/discount.model.js'
import type { DiscountFilter } from '@repositories/discount.repository.js'
import { InvalidDiscountActiveError } from '@errors/DomainErrors.js'

export class DiscountController {
    constructor(private readonly discountService: DiscountService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const discount = await this.discountService.create({
                code: req.body?.code,
                percentage: req.body?.percentage,
                active: req.body?.active
            })
            res.status(201).location(`${req.baseUrl}/${discount.id}`).json(this.toJSON(discount))
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const discounts = await this.discountService.getAll(this.parseFilter(req.query.active))
            res.status(200).json(discounts.map(d => this.toJSON(d)))
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const discount = await this.discountService.getById(req.params.id as string)
            res.status(200).json(this.toJSON(discount))
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const discount = await this.discountService.update(req.params.id as string, {
                percentage: req.body?.percentage,
                active: req.body?.active
            })
            res.status(200).json(this.toJSON(discount))
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.discountService.delete(req.params.id as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    private parseFilter(active: unknown): DiscountFilter {
        if (active === undefined) return {}
        if (active === 'true') return { active: true }
        if (active === 'false') return { active: false }
        throw new InvalidDiscountActiveError()
    }

    private toJSON(discount: Discount) {
        return {
            id: discount.id,
            code: discount.code,
            percentage: discount.percentage,
            active: discount.active,
            createdAt: discount.createdAt,
            updatedAt: discount.updatedAt
        }
    }
}

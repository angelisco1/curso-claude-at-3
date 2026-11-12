import type { Request, Response, NextFunction } from 'express'
import type { TableService } from '@services/table.service.js'
import type { AvailableTable, Table } from '@models/table.model.js'
import type { AuthRequest } from '@shared/infrastructure/http/middlewares.js'

export class TableController {
    constructor(private readonly tableService: TableService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.create(this.restaurantId(req), {
                number: req.body?.number,
                description: req.body?.description,
                capacity: req.body?.capacity
            })
            res.status(201).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.findByRestaurant(this.restaurantId(req))
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.findById(this.restaurantId(req), req.params.id as string)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.update(this.restaurantId(req), req.params.id as string, {
                number: req.body?.number,
                description: req.body?.description,
                capacity: req.body?.capacity
            })
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.tableService.delete(this.restaurantId(req), req.params.id as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    getAvailable = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const raw = req.query.people
            const people = typeof raw === 'string' && raw.trim() !== '' ? Number(raw) : NaN
            const tables = await this.tableService.findAvailable(this.restaurantId(req), people, req.user.id)
            res.status(200).json(tables.map(t => this.toAvailableJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    occupy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.occupy(this.restaurantId(req), req.params.id as string, req.body?.people, req.user.id)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.updateStatus(
                this.restaurantId(req),
                req.params.id as string,
                req.body?.status,
                req.body?.reservedForEmail
            )
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    private restaurantId(req: Request): string {
        return req.params.restaurantId as string
    }

    private toJSON(table: Table) {
        return {
            id: table.id,
            restaurantId: table.restaurantId,
            number: table.number,
            description: table.description,
            capacity: table.capacity,
            status: table.status,
            reservedForClientId: table.reservedFor,
            reservedForEmail: table.reservedForEmail,
            occupiedByClientId: table.occupiedBy,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }
    }

    private toAvailableJSON(table: AvailableTable) {
        return {
            ...this.toJSON(table),
            reservedForMe: table.reservedForMe,
            occupiedByMe: table.occupiedByMe
        }
    }
}

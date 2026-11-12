import type { Request, Response, NextFunction } from 'express'
import type { TableService } from '@services/table.service.js'
import type { Table } from '@models/table.model.js'
import type { AuthRequest } from '@shared/infrastructure/http/middlewares.js'

export class TableController {
    constructor(private readonly tableService: TableService) {}

    create = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.create(req.params.restaurantId as string, {
                number: req.body.number,
                capacity: req.body.capacity,
                description: req.body.description,
                status: req.body.status
            })
            res.status(201).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAll = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const tables = await this.tableService.findByRestaurant(req.params.restaurantId as string)
            res.status(200).json(tables.map(t => this.toJSON(t)))
        } catch (error) {
            next(error)
        }
    }

    getById = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.findById(req.params.restaurantId as string, req.params.id as string)
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    update = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.update(req.params.restaurantId as string, req.params.id as string, {
                number: req.body.number,
                capacity: req.body.capacity,
                description: req.body.description,
                status: req.body.status
            })
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    delete = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            await this.tableService.delete(req.params.restaurantId as string, req.params.id as string)
            res.status(204).send()
        } catch (error) {
            next(error)
        }
    }

    updateStatus = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
        try {
            const table = await this.tableService.updateStatus(
                req.params.restaurantId as string,
                req.params.id as string,
                req.body.status,
                req.body.reservedFor
            )
            res.status(200).json(this.toJSON(table))
        } catch (error) {
            next(error)
        }
    }

    getAvailable = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user.id as string
            const tables = await this.tableService.findAvailable(
                req.params.restaurantId as string,
                parsePeopleQuery(req.query.people),
                userId
            )
            res.status(200).json(tables.map(t => this.toClientJSON(t, userId)))
        } catch (error) {
            next(error)
        }
    }

    occupy = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
        try {
            const userId = req.user.id as string
            const table = await this.tableService.occupy(
                req.params.restaurantId as string,
                req.params.id as string,
                req.body?.people,
                userId
            )
            res.status(200).json(this.toClientJSON(table, userId))
        } catch (error) {
            next(error)
        }
    }

    private toJSON(table: Table) {
        return {
            id: table.id,
            restaurantId: table.restaurantId,
            number: table.number,
            description: table.description,
            num: table.capacity,
            status: table.status,
            reservedFor: table.reservedFor,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }
    }

    private toClientJSON(table: Table, userId: string) {
        return {
            id: table.id,
            restaurantId: table.restaurantId,
            number: table.number,
            description: table.description,
            capacity: table.capacity,
            status: table.status,
            reservedForMe: table.status === 'reservada' && table.reservedFor === userId,
            createdAt: table.createdAt,
            updatedAt: table.updatedAt
        }
    }
}

function parsePeopleQuery(value: unknown): number {
    return typeof value === 'string' && /^\d+$/.test(value) ? Number(value) : NaN
}

import { Router } from 'express'
import { DiscountController } from '@controllers/discount.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteDiscountRepository } from '@repositories/discount.repository.js'
import { DiscountService } from '@services/discount.service.js'
import { authenticate, authorize } from '@shared/infrastructure/http/middlewares.js'

const discountRepository = new SqliteDiscountRepository(dbConfig)
const discountService = new DiscountService(discountRepository)
const discountController = new DiscountController(discountService)

const router = Router()

router.post('/', authenticate, authorize(['admin']), discountController.create)
router.get('/', authenticate, authorize(['admin']), discountController.getAll)
router.get('/:id', authenticate, authorize(['admin']), discountController.getById)
router.patch('/:id', authenticate, authorize(['admin']), discountController.update)
router.delete('/:id', authenticate, authorize(['admin']), discountController.delete)

export default router

import { Router } from 'express'
import { OrderController } from '@controllers/order.controller.js'
import { OrderService } from '@services/order.service.js'
import { SqliteOrderRepository } from '@repositories/order.repository.js'
import { SqliteDiscountRepository } from '@repositories/discount.repository.js'
import { dbConfig } from '@config/database.js'
import { authenticate } from '@shared/infrastructure/http/middlewares.js'

const orderRepository = new SqliteOrderRepository(dbConfig)
const discountRepository = new SqliteDiscountRepository(dbConfig)
const orderService = new OrderService(orderRepository, discountRepository)
const orderController = new OrderController(orderService)

const router = Router()

router.post('/', authenticate, orderController.createOrder.bind(orderController))
router.get('/active', authenticate, orderController.getActiveOrders.bind(orderController))
router.get('/mine', authenticate, orderController.getMyOrders.bind(orderController))
router.get('/:id', authenticate, orderController.getById.bind(orderController))
router.put('/:id/discount', authenticate, orderController.applyDiscount.bind(orderController))
router.delete('/:id/discount', authenticate, orderController.removeDiscount.bind(orderController))
router.patch('/:orderId/items/:itemId/status', authenticate, orderController.updateItemStatus.bind(orderController))

export default router

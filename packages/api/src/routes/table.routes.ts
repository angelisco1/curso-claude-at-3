import { Router } from 'express'
import { TableController } from '@controllers/table.controller.js'
import { dbConfig } from '@config/database.js'
import { SqliteTableRepository } from '@repositories/table.repository.js'
import { SqliteRestaurantRepository } from '@repositories/restaurant.repository.js'
import { SqliteEmployeeRepository } from '@employee/infrastructure/SqliteEmployeeRepository.js'
import { TableService } from '@services/table.service.js'
import { authenticate, authorize, authorizeRestaurant } from '@shared/infrastructure/http/middlewares.js'

const tableService = new TableService(
    new SqliteTableRepository(dbConfig),
    new SqliteRestaurantRepository(dbConfig),
    new SqliteEmployeeRepository(dbConfig)
)
const tableController = new TableController(tableService)

const ADMIN = ['admin']
const READERS = ['admin', 'manager', 'camarero', 'cocinero']
const STATUS_CHANGERS = ['admin', 'manager', 'camarero']
const AVAILABILITY_READERS = ['cliente', 'admin', 'manager', 'camarero']
const OCCUPIERS = ['cliente', 'admin']

const router = Router({ mergeParams: true })

// `/available` debe declararse antes de `/:id`.
router.get('/available', authenticate, authorize(AVAILABILITY_READERS), authorizeRestaurant, tableController.getAvailable)
router.post('/', authenticate, authorize(ADMIN), tableController.create)
router.get('/', authenticate, authorize(READERS), authorizeRestaurant, tableController.getAll)
router.get('/:id', authenticate, authorize(READERS), authorizeRestaurant, tableController.getById)
router.put('/:id', authenticate, authorize(ADMIN), tableController.update)
router.delete('/:id', authenticate, authorize(ADMIN), tableController.delete)
router.post('/:id/occupy', authenticate, authorize(OCCUPIERS), tableController.occupy)
router.patch('/:id/status', authenticate, authorize(STATUS_CHANGERS), authorizeRestaurant, tableController.updateStatus)

export default router

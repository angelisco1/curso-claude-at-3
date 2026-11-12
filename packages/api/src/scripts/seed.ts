import { randomUUID } from 'crypto'
import { dbConfig } from '@config/database.js'
import { BcryptAuthService } from '@employee/infrastructure/BcryptAuthService.js'
import { SqliteEmployeeRepository } from '@employee/infrastructure/SqliteEmployeeRepository.js'
import { Employee } from '@employee/domain/Employee.js'

const seed = async () => {
    try {
        await dbConfig.initialize()
        console.log('Database initialized.')

        // Los restaurantes van primero: los empleados tienen FK a restaurants
        await dbConfig.run(`
            INSERT OR IGNORE INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['rest-1', 'Restaurante El Gourmet', 'Calle Mayor 10, Madrid', 'info@gourmet.com', '912345678', 'Carlos', 'García', new Date().toISOString(), new Date().toISOString()])

        await dbConfig.run(`
            INSERT OR IGNORE INTO restaurants (id, name, address, email, phone, owner_first_name, owner_last_name, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, ['rest-2', 'Pizzería Napoli', 'Avenida del Sol 25, Barcelona', 'info@napoli.com', '934567890', 'Marco', 'Rossi', new Date().toISOString(), new Date().toISOString()])

        console.log('Restaurants created.')

        const authService = new BcryptAuthService()
        const employeeRepo = new SqliteEmployeeRepository(dbConfig)

        const admin = await employeeRepo.findByEmail('admin@resttek.com')
        if (!admin) {
            const adminEmployee = Employee.create({
                id: randomUUID(),
                firstName: 'Admin',
                lastName: 'RestTek',
                email: 'admin@resttek.com',
                passwordHash: await authService.hashPassword('admin@resttek.com'),
                role: 'admin',
                restaurantId: null
            })
            await employeeRepo.save(adminEmployee)
            console.log('Admin created: admin@resttek.com / admin@resttek.com')
        } else {
            console.log('Admin already exists.')
        }

        const employees = [
            { firstName: 'Juan', lastName: 'García', email: 'cocinero1@resttek.com', role: 'cocinero', restaurantId: 'rest-1' },
            { firstName: 'María', lastName: 'López', email: 'camarero1@resttek.com', role: 'camarero', restaurantId: 'rest-1' },
            { firstName: 'Pedro', lastName: 'Martínez', email: 'camarero2@resttek.com', role: 'camarero', restaurantId: 'rest-1' },
            { firstName: 'Roberto', lastName: 'Díaz', email: 'gerente1@resttek.com', role: 'manager', restaurantId: 'rest-1' },
            { firstName: 'Carlos', lastName: 'Sánchez', email: 'cocinero2@resttek.com', role: 'cocinero', restaurantId: 'rest-2' },
            { firstName: 'Ana', lastName: 'Fernández', email: 'camarero3@resttek.com', role: 'camarero', restaurantId: 'rest-2' },
            { firstName: 'Sofia', lastName: 'Rossi', email: 'gerente2@resttek.com', role: 'manager', restaurantId: 'rest-2' },
            { firstName: 'Laura', lastName: 'Gómez', email: 'cliente1@resttek.com', role: 'cliente', restaurantId: null },
            { firstName: 'Pablo', lastName: 'Ruiz', email: 'cliente2@resttek.com', role: 'cliente', restaurantId: null },
        ]

        for (const emp of employees) {
            if (!await employeeRepo.findByEmail(emp.email)) {
                const employee = Employee.create({
                    id: randomUUID(),
                    firstName: emp.firstName,
                    lastName: emp.lastName,
                    email: emp.email,
                    passwordHash: await authService.hashPassword(emp.email),
                    role: emp.role,
                    restaurantId: emp.restaurantId
                })
                await employeeRepo.save(employee)
                console.log(`${emp.role} created: ${emp.email} / ${emp.email}`)
            } else {
                console.log(`${emp.role} already exists: ${emp.email}`)
            }
        }


        // Ingredientes y platos: ids fijos y, si ya existen por nombre en el restaurante
        // (bases de datos sembradas con versiones anteriores), se reutiliza su id.
        // Así el seed es idempotente y no duplica nada.
        const now = () => new Date().toISOString()

        const ensureIngredient = async (id: string, name: string, unit: string, stock: number, restaurantId: string) => {
            const existing = await dbConfig.get<{ id: string }>('SELECT id FROM ingredients WHERE name = ? AND restaurant_id = ?', [name, restaurantId])
            if (existing) return existing.id
            await dbConfig.run(`
                INSERT OR IGNORE INTO ingredients (id, name, unit, current_stock, restaurant_id, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?)
            `, [id, name, unit, stock, restaurantId, now(), now()])
            return id
        }

        const ensureDish = async (
            id: string,
            dish: { name: string, description: string, price: number, category: string, restaurantId: string },
            ingredients: [ingredientId: string, quantity: number][] = [],
        ) => {
            const existing = await dbConfig.get<{ id: string }>('SELECT id FROM dishes WHERE name = ? AND restaurant_id = ?', [dish.name, dish.restaurantId])
            const dishId = existing?.id ?? id
            if (!existing) {
                await dbConfig.run(`
                    INSERT OR IGNORE INTO dishes (id, name, description, price, category, restaurant_id, available, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
                `, [dishId, dish.name, dish.description, dish.price, dish.category, dish.restaurantId, 1, now(), now()])
            }
            for (const [ingredientId, quantity] of ingredients) {
                await dbConfig.run(`INSERT OR IGNORE INTO dish_ingredients (dish_id, ingredient_id, quantity) VALUES (?, ?, ?)`, [dishId, ingredientId, quantity])
            }
            return dishId
        }

        const tomate = await ensureIngredient('ing-rest-1-tomate', 'Tomate', 'kg', 10, 'rest-1')
        const mozzarella = await ensureIngredient('ing-rest-1-mozzarella', 'Queso mozzarella', 'kg', 10, 'rest-1')
        const aceite = await ensureIngredient('ing-rest-1-aceite', 'Aceite de oliva', 'L', 10, 'rest-1')
        const ajo = await ensureIngredient('ing-rest-1-ajo', 'Ajo', 'kg', 10, 'rest-1')
        const albahaca = await ensureIngredient('ing-rest-1-albahaca', 'Albahaca', 'kg', 10, 'rest-1')

        const dish1Id = await ensureDish('dish-rest-1-margarita',
            { name: 'Pizza Margarita', description: 'Pizza clásica con tomate, mozzarella y albahaca', price: 12.50, category: 'principal', restaurantId: 'rest-1' },
            [[tomate, 0.3], [mozzarella, 0.4], [albahaca, 0.05]])
        const dish2Id = await ensureDish('dish-rest-1-caprese',
            { name: 'Ensalada Caprese', description: 'Ensalada fresca con tomate, mozzarella y albahaca', price: 9.00, category: 'entrante', restaurantId: 'rest-1' },
            [[tomate, 0.4], [mozzarella, 0.3], [albahaca, 0.03]])
        const dish3Id = await ensureDish('dish-rest-1-bruschetta',
            { name: 'Bruschetta', description: 'Pan tostado con tomate, ajo y aceite de oliva', price: 7.50, category: 'entrante', restaurantId: 'rest-1' },
            [[tomate, 0.2], [aceite, 0.05], [ajo, 0.01]])
        const drink1Id = await ensureDish('dish-rest-1-cola',
            { name: 'Refresco de Cola', description: 'Bebida refrescante', price: 2.50, category: 'bebida', restaurantId: 'rest-1' })
        const drink2Id = await ensureDish('dish-rest-1-agua',
            { name: 'Agua Mineral', description: 'Agua mineral natural', price: 2.00, category: 'bebida', restaurantId: 'rest-1' })

        console.log('Restaurant 1 dishes created: 3 dishes + 2 drinks')

        const harina = await ensureIngredient('ing-rest-2-harina', 'Harina', 'kg', 15, 'rest-2')
        const levadura = await ensureIngredient('ing-rest-2-levadura', 'Levadura', 'kg', 15, 'rest-2')
        const tomateTriturado = await ensureIngredient('ing-rest-2-tomate-triturado', 'Tomate triturado', 'kg', 15, 'rest-2')

        await ensureDish('dish-rest-2-napolitana',
            { name: 'Pizza Napolitana', description: 'Pizza al estilo napolitano con tomate y mozzarella', price: 14.00, category: 'principal', restaurantId: 'rest-2' },
            [[harina, 0.5], [levadura, 0.02], [tomateTriturado, 0.3]])
        await ensureDish('dish-rest-2-limonada',
            { name: 'Limonada Casera', description: 'Limonada recién hecha', price: 3.50, category: 'bebida', restaurantId: 'rest-2' })

        console.log('Restaurant 2 dishes created: 1 dish + 1 drink')

        // Códigos de descuento globales (code es UNIQUE: INSERT OR IGNORE los hace idempotentes)
        const discounts = [
            { id: 'discount-1', code: 'DISCOUNT30', percentage: 30, active: 1 },
            { id: 'discount-2', code: 'WELCOME10', percentage: 10, active: 1 },
            { id: 'discount-3', code: 'BLACK_FRIDAY', percentage: 50, active: 0 },
        ]
        for (const discount of discounts) {
            await dbConfig.run(`
                INSERT OR IGNORE INTO discounts (id, code, percentage, active, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [discount.id, discount.code, discount.percentage, discount.active, new Date().toISOString(), new Date().toISOString()])
        }

        console.log('Discounts created: DISCOUNT30 (30%), WELCOME10 (10%), BLACK_FRIDAY (50%, inactivo)')

        // Mesas de ejemplo con ids fijos (INSERT OR IGNORE las hace idempotentes)
        const tables: { id: string, restaurantId: string, number: number, capacity: number, description: string | null, status?: string }[] = [
            { id: 'table-rest-1-1', restaurantId: 'rest-1', number: 1, capacity: 2, description: 'Junto a la ventana' },
            { id: 'table-rest-1-2', restaurantId: 'rest-1', number: 2, capacity: 2, description: null },
            { id: 'table-rest-1-3', restaurantId: 'rest-1', number: 3, capacity: 4, description: 'Terraza' },
            { id: 'table-rest-1-4', restaurantId: 'rest-1', number: 4, capacity: 4, description: null },
            { id: 'table-rest-1-5', restaurantId: 'rest-1', number: 5, capacity: 6, description: 'Salón principal', status: 'ocupada' },
            { id: 'table-rest-1-6', restaurantId: 'rest-1', number: 6, capacity: 6, description: null },
            { id: 'table-rest-2-1', restaurantId: 'rest-2', number: 1, capacity: 2, description: null },
            { id: 'table-rest-2-2', restaurantId: 'rest-2', number: 2, capacity: 4, description: 'Terraza' },
            { id: 'table-rest-2-3', restaurantId: 'rest-2', number: 3, capacity: 4, description: null },
            { id: 'table-rest-2-4', restaurantId: 'rest-2', number: 4, capacity: 6, description: 'Reservado para grupos' },
        ]
        for (const table of tables) {
            await dbConfig.run(`
                INSERT OR IGNORE INTO tables (id, restaurant_id, number, description, capacity, status, created_at, updated_at)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            `, [table.id, table.restaurantId, table.number, table.description, table.capacity, table.status ?? 'libre', new Date().toISOString(), new Date().toISOString()])
        }

        console.log('Tables created: 6 in rest-1 (table-rest-1-1..6) and 4 in rest-2 (table-rest-2-1..4)')

        // Pedido de ejemplo en la mesa 5 de rest-1 (ocupada), con ids fijos
        const order1Id = 'order-seed-1'
        await dbConfig.run(`
            INSERT OR IGNORE INTO orders (id, restaurant_id, table_id, client_id, created_at)
            VALUES (?, ?, ?, ?, ?)
        `, [order1Id, 'rest-1', 'table-rest-1-5', null, now()])

        const orderItems: [dishId: string, quantity: number, notes: string | null, status: string][] = [
            [dish1Id, 1, null, 'pendiente'],
            [dish1Id, 1, null, 'pendiente'],
            [dish2Id, 1, 'Sin cebolla', 'pendiente'],
            [dish2Id, 1, 'Sin cebolla', 'pendiente'],
            [dish2Id, 1, 'Sin cebolla', 'pendiente'],
            [dish3Id, 1, null, 'preparando'],
            [drink1Id, 1, null, 'pendiente'],
            [drink2Id, 2, null, 'pendiente'],
        ]
        for (const [index, [dishId, quantity, notes, status]] of orderItems.entries()) {
            await dbConfig.run(`
                INSERT OR IGNORE INTO order_items (id, order_id, dish_id, quantity, notes, status)
                VALUES (?, ?, ?, ?, ?, ?)
            `, [`${order1Id}-item-${index + 1}`, order1Id, dishId, quantity, notes, status])
        }

        console.log('Sample orders created')

        console.log('\n=== Seed completado ===')
        console.log('\nEmpleados:')
        console.log('  Admin: admin@resttek.com / admin@resttek.com')
        console.log('  Cocinero: cocinero1@resttek.com / cocinero1@resttek.com')
        console.log('  Camarero: camarero1@resttek.com / camarero1@resttek.com')
        console.log('  Camarero: camarero2@resttek.com / camarero2@resttek.com')
        console.log('  Gerente: gerente1@resttek.com / gerente1@resttek.com')
        console.log('  Cocinero: cocinero2@resttek.com / cocinero2@resttek.com')
        console.log('  Camarero: camarero3@resttek.com / camarero3@resttek.com')
        console.log('  Gerente: gerente2@resttek.com / gerente2@resttek.com')
        console.log('\nClientes:')
        console.log('  cliente1@resttek.com / cliente1@resttek.com')
        console.log('  cliente2@resttek.com / cliente2@resttek.com')

        await dbConfig.close()
    } catch (error) {
        console.error('Seed failed:', error)
        process.exit(1)
    }
}

seed()

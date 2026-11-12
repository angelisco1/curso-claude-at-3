import { AppError } from '@errors/AppError.js'

export class FirstNameRequiredError extends AppError {
  constructor() {
    super('First name is required')
  }
}

export class LastNameRequiredError extends AppError {
  constructor() {
    super('Last name is required')
  }
}

export class PasswordHashRequiredError extends AppError {
  constructor() {
    super('Password hash is required')
  }
}

export class InvalidRoleError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid role')
  }
}

export class InvalidEmailError extends AppError {
  constructor() {
    super('Invalid email format')
  }
}

export class InvalidCredentialsError extends AppError {
  constructor() {
    super('Invalid credentials')
  }
}

export class DuplicatedEmailError extends AppError {
  constructor() {
    super('Email is already in use')
  }
}

export class EmployeeNotFoundError extends AppError {
  constructor() {
    super('Employee not found')
  }
}

export class RestaurantNameRequiredError extends AppError {
  constructor() {
    super('Restaurant name is required')
  }
}

export class RestaurantAddressRequiredError extends AppError {
  constructor() {
    super('Restaurant address is required')
  }
}

export class RestaurantEmailRequiredError extends AppError {
  constructor() {
    super('Restaurant email is required')
  }
}

export class RestaurantNotFoundError extends AppError {
  constructor() {
    super('Restaurant not found')
  }
}

export class InvalidPhoneError extends AppError {
  constructor() {
    super('Invalid phone format')
  }
}

export class OwnerFirstNameRequiredError extends AppError {
  constructor() {
    super('Owner first name is required')
  }
}

export class OwnerLastNameRequiredError extends AppError {
  constructor() {
    super('Owner last name is required')
  }
}

export class IngredientNameRequiredError extends AppError {
  constructor() {
    super('Ingredient name is required')
  }
}

export class IngredientNotFoundError extends AppError {
  constructor() {
    super('Ingredient not found')
  }
}

export class InvalidUnitError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid unit')
  }
}

export class NegativeStockError extends AppError {
  constructor() {
    super('Stock cannot be negative')
  }
}

export class RestaurantIdRequiredError extends AppError {
  constructor() {
    super('Restaurant ID is required')
  }
}

export class DishNameRequiredError extends AppError {
  constructor() {
    super('Dish name is required')
  }
}

export class InvalidPriceError extends AppError {
  constructor() {
    super('Price must be a positive number')
  }
}

export class InvalidCategoryError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid category')
  }
}

export class DishNotFoundError extends AppError {
  constructor() {
    super('Dish not found')
  }
}

export class DatabaseNotInitializedError extends AppError {
  constructor() {
    super('Database is not initialized. Call dbConfig.initialize() first.')
  }
}

export class InvalidOrderStatusError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid order status')
  }
}

export class OrderNotFoundError extends AppError {
  constructor() {
    super('Order not found')
  }
}

export class DiscountNotFoundError extends AppError {
  constructor() {
    super('Discount not found')
  }
}

export class InvalidDiscountCodeError extends AppError {
  constructor() {
    super('Discount code must match ^[A-Z0-9_-]{3,30}$')
  }
}

export class InvalidDiscountPercentageError extends AppError {
  constructor() {
    super('Discount percentage must be an integer between 1 and 100')
  }
}

export class InvalidDiscountActiveError extends AppError {
  constructor() {
    super('Active must be a boolean')
  }
}

export class DuplicatedDiscountCodeError extends AppError {
  constructor() {
    super('Discount code already exists')
  }
}

export class DiscountInactiveError extends AppError {
  constructor() {
    super('Discount is not active')
  }
}

export class OrderDiscountAlreadyAppliedError extends AppError {
  constructor() {
    super('Order already has a discount applied')
  }
}

export class OrderAccessDeniedError extends AppError {
  constructor() {
    super('Order belongs to another client')
  }
}

export class TableNotFoundError extends AppError {
  constructor() {
    super('Table not found')
  }
}

export class InvalidTableStatusError extends AppError {
  constructor(message?: string) {
    super(message ?? 'Invalid table status')
  }
}

export class InvalidTableNumberError extends AppError {
  constructor() {
    super('Table number must be an integer greater than or equal to 1')
  }
}

export class InvalidTableCapacityError extends AppError {
  constructor() {
    super('Table capacity must be an integer greater than or equal to 1')
  }
}

export class InvalidPeopleCountError extends AppError {
  constructor() {
    super('People count must be an integer greater than or equal to 1')
  }
}

export class InvalidReservationClientError extends AppError {
  constructor() {
    super('Reservation client not found')
  }
}

export class DuplicatedTableNumberError extends AppError {
  constructor() {
    super('Table number already exists in this restaurant')
  }
}

export class TableNotAvailableError extends AppError {
  constructor() {
    super('Table is not available')
  }
}

export class TableOccupiedError extends AppError {
  constructor() {
    super('Cannot delete an occupied table')
  }
}

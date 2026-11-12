import { test, expect, type APIRequestContext, type Page } from '@playwright/test'
import { API_URL, ADMIN_URL, CLIENTES_URL, EMPLEADOS_URL } from './urls'

/**
 * Recorrido completo de mesas + códigos de descuento en las tres apps.
 * Cada test genera su propio vídeo en e2e/test-results/.
 *
 *  1. Admin crea el código E2E20 (20 %).
 *  2. Cliente elige restaurante, nº de personas y mesa, pide y aplica el código.
 *  3. Camarero ve la mesa ocupada con el pedido (y su descuento) y la libera.
 */

const RESTAURANT_ID = 'rest-1'
const CODE = 'E2E20'
const PERCENTAGE = 20
const PEOPLE = 2

async function login(request: APIRequestContext, email: string) {
  const response = await request.post(`${API_URL}/auth/login`, { data: { email, password: email } })
  expect(response.ok(), `login de ${email} (¿has ejecutado npm run seed?)`).toBeTruthy()
  const { token, employee } = await response.json()
  return { token: token as string, user: employee }
}

/** Abre la app ya autenticada (misma sesión que guarda @resttek/web-shared). */
async function loginInApp(page: Page, request: APIRequestContext, email: string) {
  const { token, user } = await login(request, email)
  await page.addInitScript(
    ([t, u]) => {
      localStorage.setItem('auth_token', t)
      localStorage.setItem('auth_user', u)
    },
    [token, JSON.stringify(user)],
  )
}

test.describe.serial('Mesas y códigos de descuento', () => {
  let tableNumber: string
  let orderId: string

  test.beforeAll(async ({ request }) => {
    // Estado de partida conocido: mesas de rest-1 libres y sin el código E2E.
    const { token } = await login(request, 'admin@resttek.com')
    const headers = { Authorization: `Bearer ${token}` }

    const tables = await (await request.get(`${API_URL}/restaurants/${RESTAURANT_ID}/tables`, { headers })).json()
    for (const table of tables) {
      if (table.status !== 'libre') {
        const res = await request.patch(`${API_URL}/restaurants/${RESTAURANT_ID}/tables/${table.id}/status`, {
          headers,
          data: { status: 'libre' },
        })
        expect(res.ok(), `liberar mesa ${table.number}`).toBeTruthy()
      }
    }

    const discounts = await (await request.get(`${API_URL}/discounts`, { headers })).json()
    const previous = discounts.find((d: { code: string }) => d.code === CODE)
    if (previous) await request.delete(`${API_URL}/discounts/${previous.id}`, { headers })
  })

  test('1. el admin crea el código de descuento', async ({ page, request }) => {
    await loginInApp(page, request, 'admin@resttek.com')
    await page.goto(ADMIN_URL)

    await page.getByTestId('nav-discounts').click()
    await expect(page).toHaveURL(/\/discounts/)

    await page.getByTestId('discount-code-input').fill(CODE.toLowerCase()) // se normaliza a mayúsculas
    await page.getByTestId('discount-percentage-input').fill(String(PERCENTAGE))
    await page.getByTestId('discount-create-button').click()

    const row = page.getByTestId(`discount-row-${CODE}`)
    await expect(row).toBeVisible()
    await expect(row.getByTestId('discount-row-code')).toHaveText(CODE)
    await expect(row.getByTestId('discount-row-percentage')).toContainText(String(PERCENTAGE))
    await expect(row.getByTestId('discount-row-status')).toHaveText('Activo')

    // Crear el mismo código otra vez → 409
    await page.getByTestId('discount-code-input').fill(CODE)
    await page.getByTestId('discount-percentage-input').fill('10')
    await page.getByTestId('discount-create-button').click()
    await expect(page.getByTestId('discount-form-error')).toBeVisible()

    // Vista de las mesas del restaurante en el admin
    await page.goto(`${ADMIN_URL}/restaurants/${RESTAURANT_ID}/tables`)
    await expect(page.getByTestId('tables-table')).toBeVisible()
    await expect(page.getByTestId('table-row-status').first()).toContainText(/libre/i)
    await page.waitForTimeout(1000)
  })

  test('2. el cliente ocupa una mesa, pide y aplica el código', async ({ page, request }) => {
    await loginInApp(page, request, 'cliente1@resttek.com')
    await page.goto(`${CLIENTES_URL}/restaurants`)

    await page.getByTestId(`restaurant-card-${RESTAURANT_ID}`).click()
    await expect(page).toHaveURL(new RegExp(`/restaurants/${RESTAURANT_ID}/table`))

    await page.getByTestId('people-input').fill(String(PEOPLE))
    await page.getByTestId('search-tables-button').click()
    await expect(page.getByTestId('available-tables')).toBeVisible()

    const firstTable = page.locator('[data-testid^="table-card-"]').first()
    tableNumber = (await firstTable.getAttribute('data-testid'))!.replace('table-card-', '')
    await firstTable.click()
    await expect(firstTable).toHaveAttribute('aria-pressed', 'true')
    await page.getByTestId('continue-button').click()

    // Carta con la mesa asignada
    await expect(page).toHaveURL(new RegExp(`/restaurants/${RESTAURANT_ID}$`))
    await expect(page.getByTestId('menu-table-number')).toContainText(tableNumber)

    const dishes = page.locator('[data-testid^="dish-card-"]')
    await dishes.nth(0).getByTestId('add-to-cart-button').click()
    await dishes.nth(1).getByTestId('add-to-cart-button').click()
    await page.getByTestId('view-cart-link').click()

    await expect(page).toHaveURL(/\/cart/)
    await expect(page.getByTestId('cart-table-number')).toContainText(tableNumber)
    await page.getByTestId('discount-code-input').fill(CODE)
    await page.getByTestId('confirm-order-button').click()

    // Detalle del pedido con el descuento aplicado
    await expect(page).toHaveURL(/\/orders\/[^/]+$/)
    orderId = page.url().split('/').pop()!
    await expect(page.getByTestId('order-discount-code')).toContainText(CODE)
    await expect(page.getByTestId('order-discount-code')).toContainText(`${PERCENTAGE}`)

    const amount = (t: string) => Number(t.replace(/[^\d,.-]/g, '').replace(',', '.'))
    const subtotal = amount(await page.getByTestId('order-subtotal').innerText())
    const total = amount(await page.getByTestId('order-total').innerText())
    expect(subtotal).toBeGreaterThan(0)
    expect(total).toBeCloseTo(subtotal * (1 - PERCENTAGE / 100), 2)
    await page.waitForTimeout(1500)
  })

  test('3. el camarero ve la mesa ocupada con el pedido y la libera', async ({ page, request }) => {
    expect(tableNumber, 'el test 2 debe haber ocupado una mesa').toBeTruthy()
    await loginInApp(page, request, 'camarero1@resttek.com')
    await page.goto(EMPLEADOS_URL)

    await page.getByTestId('nav-mesas').click()
    await expect(page.getByTestId('mesas-grid')).toBeVisible()

    const card = page.getByTestId(`mesa-card-${tableNumber}`)
    await expect(card.getByTestId('mesa-status')).toContainText(/ocupada/i)
    const order = card.getByTestId(`mesa-order-${orderId}`)
    await expect(order).toBeVisible()
    await expect(order).toContainText(CODE)
    await order.scrollIntoViewIfNeeded()
    await page.waitForTimeout(1500)

    await card.getByTestId('mesa-status-select').selectOption('libre')
    await expect(card.getByTestId('mesa-status')).toContainText(/libre/i)
    await page.waitForTimeout(1500)
  })
})

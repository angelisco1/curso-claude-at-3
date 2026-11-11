import type { Page } from '@playwright/test'
import { test, expect, loginAsAdmin, API_URL } from './fixtures/auth'

test.use({ video: 'on', launchOptions: { slowMo: 250 }, viewport: { width: 1280, height: 800 } })

/** Pulsa Tab hasta que el foco llega al elemento indicado (solo teclado). */
async function tabUntil(page: Page, selector: string, maxTabs = 60) {
  for (let i = 0; i < maxTabs; i++) {
    const reached = await page.evaluate((sel) => document.activeElement?.matches(sel) ?? false, selector)
    if (reached) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`No se llegó a ${selector} con Tab en ${maxTabs} pulsaciones`)
}

const focused = (page: Page) => page.locator(':focus')

test('recorrido con teclado del formulario de nuevo plato', async ({ page, request }) => {
  // Nombres de ingredientes del seed (solo para saber qué teclear en el desplegable)
  const { token } = await loginAsAdmin(request)
  const ingredientsResponse = await request.get(`${API_URL}/restaurants/rest-1/ingredients`, {
    headers: { Authorization: `Bearer ${token}` },
  })
  const ingredients: { name: string }[] = await ingredientsResponse.json()
  expect(ingredients.length, 'el seed debe crear al menos 2 ingredientes en rest-1').toBeGreaterThanOrEqual(2)
  const [first, second] = ingredients

  await page.goto('/restaurants/rest-1/dishes/new')
  await expect(page.getByRole('heading', { level: 1, name: 'Nuevo plato' })).toBeVisible()

  // --- Parte 1: datos y errores ---
  await tabUntil(page, 'a.back-link')
  await expect(focused(page)).toHaveAttribute('aria-label', 'Volver a la lista de platos')

  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('dish-name')
  await page.keyboard.type('Pizza')
  await expect(focused(page)).toHaveValue('Pizza')
  await page.keyboard.press('ControlOrMeta+a')
  await page.keyboard.press('Backspace')
  await expect(focused(page)).toHaveValue('')

  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('dish-price')
  await page.keyboard.type('12.5')
  await expect(focused(page)).toHaveValue('12.5')

  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('dish-category')
  await page.keyboard.type('Postre')
  await expect(page.locator('#dish-category option:checked')).toHaveText('Postre')

  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('dish-available')
  await page.keyboard.type('No')
  await expect(page.locator('#dish-available option:checked')).toHaveText('No')

  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('dish-description')
  await page.keyboard.type('Postre de prueba creado solo con teclado')
  await expect(focused(page)).toHaveValue('Postre de prueba creado solo con teclado')

  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('new-ingredient')
  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('new-ingredient-qty')
  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveAttribute('aria-label', 'Añadir ingrediente')
  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveText('Cancelar')
  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveText('Guardar')

  // Enviar con el nombre vacío: resumen de errores y foco en el nombre
  await page.keyboard.press('Enter')
  await expect(page.getByRole('alert')).toContainText('Revisa los campos marcados: 1 error')
  await expect(focused(page)).toHaveId('dish-name')
  await expect(page.locator('#dish-name')).toHaveAttribute('aria-invalid', 'true')

  // --- Parte 2: ingredientes y alta ---
  // Del nombre (con error) al bloque de ingredientes: precio, categoría, disponible, descripción, ingrediente
  for (const id of ['dish-price', 'dish-category', 'dish-available', 'dish-description', 'new-ingredient']) {
    await page.keyboard.press('Tab')
    await expect(focused(page)).toHaveId(id)
  }

  // Intentar añadir sin seleccionar ingrediente: error asociado y foco de vuelta al select
  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveId('new-ingredient-qty')
  await page.keyboard.press('Tab')
  await expect(focused(page)).toHaveAttribute('aria-label', 'Añadir ingrediente')
  await page.keyboard.press('Enter')
  await expect(page.locator('#new-ingredient-error')).toHaveText(/Selecciona un ingrediente/)
  await expect(focused(page)).toHaveId('new-ingredient')
  await expect(focused(page)).toHaveAttribute('aria-invalid', 'true')

  // Añadir dos ingredientes con cantidad, usando Enter sobre el botón
  for (const [ingredient, quantity] of [
    [first, '2'],
    [second, '3'],
  ] as const) {
    await page.keyboard.type(ingredient.name)
    await expect(page.locator('#new-ingredient option:checked')).toContainText(ingredient.name)
    await page.keyboard.press('Tab')
    await expect(focused(page)).toHaveId('new-ingredient-qty')
    await page.keyboard.press('ControlOrMeta+a')
    await page.keyboard.type(quantity)
    await page.keyboard.press('Tab')
    await expect(focused(page)).toHaveAttribute('aria-label', 'Añadir ingrediente')
    await page.keyboard.press('Enter')
    await expect(page.locator('[aria-live="polite"]')).toContainText(`${ingredient.name}`)
    await expect(page.locator('[aria-live="polite"]')).toContainText('añadido')
    await expect(focused(page)).toHaveId('new-ingredient')
  }
  await expect(page.locator('ul.ingredient-chips > li')).toHaveCount(2)

  // Quitar el primero con Espacio: el foco pasa al botón Quitar del que queda
  await page.keyboard.press('Shift+Tab')
  await expect(focused(page)).toHaveAttribute('aria-label', new RegExp(`^Quitar ${second.name}`))
  await page.keyboard.press('Shift+Tab')
  await expect(focused(page)).toHaveAttribute('aria-label', new RegExp(`^Quitar ${first.name}`))
  await page.keyboard.press('Space')
  await expect(page.locator('[aria-live="polite"]')).toContainText('eliminado')
  await expect(page.locator('ul.ingredient-chips > li')).toHaveCount(1)
  await expect(focused(page)).toHaveAttribute('aria-label', new RegExp(`^Quitar ${second.name}`))

  // Volver al nombre con Shift+Tab y escribir un nombre único
  const dishName = `Plato a11y ${Date.now()}`
  for (const id of ['dish-description', 'dish-available', 'dish-category', 'dish-price', 'dish-name']) {
    await page.keyboard.press('Shift+Tab')
    await expect(focused(page)).toHaveId(id)
  }
  await page.keyboard.type(dishName)
  await expect(focused(page)).toHaveValue(dishName)

  // Ir a Guardar y enviar con Enter
  await tabUntil(page, 'button[type="submit"]')
  await expect(focused(page)).toHaveText('Guardar')
  await page.keyboard.press('Enter')

  await expect(page).toHaveURL(/\/restaurants\/rest-1\/dishes$/)
  const newDish = page.getByText(dishName)
  await expect(newDish).toBeVisible()

  // Dejar el plato nuevo a la vista (y unos segundos en el vídeo)
  await newDish.scrollIntoViewIfNeeded()
  await page.waitForTimeout(2000)

  // Guardar el vídeo del recorrido (el vídeo se finaliza al cerrar la página)
  const video = page.video()
  await page.close()
  await video?.saveAs('e2e-videos/dish-form-keyboard.webm')
})

import type { Page } from '@playwright/test'
import { test, expect } from './fixtures/auth'

test.use({ video: 'on', launchOptions: { slowMo: 250 }, viewport: { width: 1280, height: 800 } })

/** Pulsa Tab hasta que el foco llega al elemento indicado (solo teclado). */
async function tabUntil(page: Page, selector: string, maxTabs = 60) {
  for (let i = 0; i < maxTabs; i++) {
    const reached = await page.evaluate(sel => document.activeElement?.matches(sel) ?? false, selector)
    if (reached) return
    await page.keyboard.press('Tab')
  }
  throw new Error(`No se llegó a ${selector} con Tab en ${maxTabs} pulsaciones`)
}

const focused = (page: Page) => page.locator(':focus')

test('recorrido con teclado del formulario de nuevo plato', async ({ page }) => {
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
})

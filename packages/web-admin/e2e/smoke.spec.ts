import { test, expect } from './fixtures/auth'

test('el formulario de nuevo plato se ve autenticado', async ({ page }) => {
  await page.goto('/restaurants/rest-1/dishes/new')
  await expect(page.getByText('Nuevo plato')).toBeVisible()
  await expect(page.locator('input[name="name"]')).toBeVisible()
})

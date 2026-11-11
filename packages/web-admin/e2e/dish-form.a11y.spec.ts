import AxeBuilder from '@axe-core/playwright'
import type { Page } from '@playwright/test'
import { test, expect, loginAsAdmin, API_URL } from './fixtures/auth'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

// El contenedor tiene una animación fade-in: auditar a mitad de animación da contrastes falsos
const waitForAnimations = (page: Page) =>
  page.waitForFunction(() => document.getAnimations().every((a) => a.playState === 'finished'))

test.describe('accesibilidad del formulario de platos (axe)', () => {
  test('formulario vacío sin violaciones WCAG 2.2 A/AA', async ({ page }) => {
    await page.goto('/restaurants/rest-1/dishes/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo plato' })).toBeVisible()
    await expect(page).toHaveTitle('Nuevo plato · RestTek')

    await waitForAnimations(page)
    const results = await new AxeBuilder({ page }).include('form').withTags(WCAG_TAGS).analyze()

    expect(results.violations).toEqual([])
  })

  test('con errores visibles sin violaciones WCAG 2.2 A/AA', async ({ page }) => {
    await page.goto('/restaurants/rest-1/dishes/new')
    await page.getByRole('button', { name: 'Guardar' }).click()
    await expect(page.getByRole('alert')).toContainText('Revisa los campos marcados: 2 errores')
    await expect(page.locator('#dish-name-error')).toBeVisible()

    await waitForAnimations(page)
    const results = await new AxeBuilder({ page }).include('app-dish-form').withTags(WCAG_TAGS).analyze()

    expect(results.violations).toEqual([])
  })

  test('en modo edición sin violaciones WCAG 2.2 A/AA', async ({ page, request }) => {
    const { token } = await loginAsAdmin(request)
    const response = await request.get(`${API_URL}/restaurants/rest-1/dishes`, {
      headers: { Authorization: `Bearer ${token}` },
    })
    expect(response.ok()).toBeTruthy()
    const dishes: { id: string; name: string }[] = await response.json()
    expect(dishes.length, 'el seed debe crear platos en rest-1').toBeGreaterThan(0)

    await page.goto(`/restaurants/rest-1/dishes/${dishes[0].id}/edit`)
    await expect(page.getByRole('heading', { level: 1, name: 'Editar plato' })).toBeVisible()
    await expect(page.getByLabel('Nombre del plato')).toHaveValue(dishes[0].name)
    await expect(page).toHaveTitle('Editar plato · RestTek')

    await waitForAnimations(page)
    const results = await new AxeBuilder({ page }).include('form').withTags(WCAG_TAGS).analyze()

    expect(results.violations).toEqual([])
  })
})

import AxeBuilder from '@axe-core/playwright'
import { test, expect } from './fixtures/auth'

const WCAG_TAGS = ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa']

test.describe('accesibilidad del formulario de platos (axe)', () => {
  test('formulario vacío sin violaciones WCAG 2.2 A/AA', async ({ page }) => {
    await page.goto('/restaurants/rest-1/dishes/new')
    await expect(page.getByRole('heading', { level: 1, name: 'Nuevo plato' })).toBeVisible()
    await expect(page).toHaveTitle('Nuevo plato · RestTek')

    const results = await new AxeBuilder({ page }).include('form').withTags(WCAG_TAGS).analyze()

    expect(results.violations).toEqual([])
  })
})

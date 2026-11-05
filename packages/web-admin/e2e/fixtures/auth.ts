import { test as base, expect } from '@playwright/test'

const ADMIN_EMAIL = 'admin@resttek.com'
const API_URL = 'http://localhost:3000'

export const test = base.extend({
  page: async ({ page, request }, use) => {
    const response = await request.post(`${API_URL}/api/v1/auth/login`, {
      data: { email: ADMIN_EMAIL, password: ADMIN_EMAIL },
    })
    expect(response.ok(), 'login del admin (¿has ejecutado npm run seed?)').toBeTruthy()
    const { token, employee } = await response.json()

    await page.addInitScript(
      ([t, u]) => {
        localStorage.setItem('auth_token', t)
        localStorage.setItem('auth_user', u)
      },
      [token, JSON.stringify(employee)],
    )
    await use(page)
  },
})

export { expect }

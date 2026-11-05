import { test as base, expect, type APIRequestContext } from '@playwright/test'

const ADMIN_EMAIL = 'admin@resttek.com'
export const API_URL = 'http://localhost:3000/api/v1'

export async function loginAsAdmin(request: APIRequestContext) {
  const response = await request.post(`${API_URL}/auth/login`, {
    data: { email: ADMIN_EMAIL, password: ADMIN_EMAIL },
  })
  expect(response.ok(), 'login del admin (¿has ejecutado npm run seed?)').toBeTruthy()
  const { token, employee } = await response.json()
  return { token: token as string, employee }
}

export const test = base.extend({
  page: async ({ page, request }, use) => {
    const { token, employee } = await loginAsAdmin(request)

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

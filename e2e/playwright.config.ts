import { defineConfig, devices } from '@playwright/test'

/**
 * E2E de flujos que cruzan las tres apps (mesas + códigos de descuento).
 * Usa puertos propios (API :3099, apps :4300-4302) para no chocar con
 * servidores de desarrollo que ya estén en marcha.
 */

const ngServe = (pkg: string, port: number) => ({
  command: `npx ng serve --port ${port} --proxy-config ../../e2e/proxy.e2e.json`,
  cwd: `../packages/${pkg}`,
  url: `http://localhost:${port}`,
  reuseExistingServer: true,
  timeout: 180_000,
})

export default defineConfig({
  testDir: '.',
  outputDir: './test-results',
  fullyParallel: false,
  workers: 1,
  timeout: 120_000,
  reporter: [['list'], ['html', { outputFolder: './playwright-report', open: 'never' }]],
  use: {
    video: 'on',
    viewport: { width: 1280, height: 800 },
    launchOptions: { slowMo: 300 },
    trace: 'retain-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'], viewport: { width: 1280, height: 800 } } }],
  webServer: [
    {
      command: 'PORT=3099 npx tsx src/server.ts',
      cwd: '../packages/api',
      url: 'http://localhost:3099/health',
      reuseExistingServer: true,
      timeout: 60_000,
    },
    ngServe('web-admin', 4300),
    ngServe('web-empleados', 4301),
    ngServe('web-clientes', 4302),
  ],
})

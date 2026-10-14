import { defineConfig, devices } from '@playwright/test';

const CI = !!process.env['CI'];

/**
 * E2E contra los builds de producción (web SSR :4000 + BFF :3000) y la PokéAPI real.
 * Requiere `npm run build` previo. Con la PokéAPI real el primer índice tarda ~1-2 s: de ahí los timeouts.
 */
export default defineConfig({
  testDir: './e2e',
  timeout: 60_000,
  expect: { timeout: 20_000 },
  fullyParallel: true,
  workers: CI ? 2 : undefined,
  retries: CI ? 2 : 0,
  reporter: CI ? [['list'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4000',
    locale: 'es-CL',
    // El SW saltaría la intercepción de red (page.route); solo los tests de PWA lo permiten.
    serviceWorkers: 'block',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm start',
    cwd: '../..',
    url: 'http://localhost:4000/api/health',
    // El límite de peticiones se cubre en el e2e del BFF; aquí no debe interferir entre tests paralelos.
    env: { THROTTLE_LIMIT: '100000' },
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});

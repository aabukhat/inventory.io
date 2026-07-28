import { defineConfig, devices } from '@playwright/test'
import { loadTestEnv } from './scripts/loadTestEnv.js'

// Playwright (unlike Vitest) doesn't run through Vite, so nothing populates
// process.env from .env.test.local automatically — test fixture files
// (tests/e2e/fixtures/*.js) need it directly to talk to the local Supabase
// stack. Workers Playwright spawns inherit process.env from this process.
Object.assign(process.env, loadTestEnv())

// baseURL targets a production build+preview (not `vite dev`) so this suite
// exercises what Netlify actually deploys, not the dev-server/HMR path.
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
})

import { defineConfig, devices } from '@playwright/test';

const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
const port = new URL(baseURL).port || '3000';

export default defineConfig({
  testDir: './tests',
  timeout: 30_000,
  expect: { timeout: 5_000 },

  // Parallelism: every test in every file may run on any worker.
  // Isolation comes from per-test browser contexts and per-test data (see tests/fixtures.ts).
  fullyParallel: true,
  workers: process.env.WORKERS ? Number(process.env.WORKERS) : process.env.CI ? 4 : undefined,
  forbidOnly: Boolean(process.env.CI),
  // One retry locally so that intermittent failures show up as "flaky" instead of hiding.
  retries: process.env.CI ? 2 : 1,

  reporter: [
    ['list'],
    ['html', { outputFolder: 'reports/html', open: 'never' }],
    ['json', { outputFile: 'reports/results.json' }],
  ],
  outputDir: 'reports/artifacts',

  globalSetup: './global-setup.ts',

  // The app under test is started by Playwright unless one is already running.
  webServer: {
    command: 'node app/server.js',
    url: `${baseURL}/api/health`,
    reuseExistingServer: !process.env.CI,
    env: { ...process.env, PORT: port } as Record<string, string>,
    timeout: 20_000,
  },

  use: {
    baseURL,
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',
  },

  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    // Only smoke tests run on the mobile profile: a cheap cross-device check.
    { name: 'mobile-chrome', use: { ...devices['Pixel 5'] }, grep: /@smoke/ },
  ],
});

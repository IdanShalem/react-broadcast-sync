import { defineConfig } from '@playwright/test';

export default defineConfig({
  testDir: './integration/tests',
  timeout: 30000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:5199',
  },
  webServer: {
    command: 'npm run dev:integration',
    url: 'http://localhost:5199',
    reuseExistingServer: !process.env.CI,
    timeout: 60000,
  },
});

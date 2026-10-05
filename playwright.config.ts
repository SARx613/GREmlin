import { defineConfig } from '@playwright/test';

// Lance le site construit (vite preview) et le teste dans Chrome.
// En CI sans Chrome : `npx playwright install chromium` puis PW_CHANNEL=chromium npm run e2e
export default defineConfig({
  testDir: 'e2e',
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  use: {
    baseURL: 'http://localhost:4173',
    channel: process.env.PW_CHANNEL === 'chromium' ? undefined : 'chrome',
    serviceWorkers: 'allow',
  },
  webServer: {
    command: 'npm run build && npx vite preview --port 4173 --strictPort',
    url: 'http://localhost:4173',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});

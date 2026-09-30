import { defineConfig } from '@playwright/test';

const deployedURL = process.env.BOOTH_BASE_URL;
export default defineConfig({
  testDir: './tests', fullyParallel: false, workers: 1, timeout: 45000,
  reporter: 'list',
  use: { baseURL: deployedURL || 'http://127.0.0.1:5173', browserName: 'chromium', channel: 'msedge', headless: true, viewport: { width: 1505, height: 1045 } },
  webServer: deployedURL ? undefined : { command: 'npm run dev -- --port 5173', url: 'http://127.0.0.1:5173', reuseExistingServer: true },
});

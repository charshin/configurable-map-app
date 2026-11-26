import { defineConfig, devices } from '@playwright/test';

// Instant-navigation tests. They need a production build with the testing API
// exposed and the API running; see instant-nav.rig.md.
const PORT = 3100;

export default defineConfig({
  testDir: './e2e',
  fullyParallel: false,
  workers: 1,
  reporter: 'list',
  use: {
    baseURL: `http://localhost:${PORT}`,
    ...devices['Desktop Chrome'],
  },
  webServer: {
    command: `next start --port ${PORT}`,
    url: `http://localhost:${PORT}`,
    reuseExistingServer: false,
    env: { EXPOSE_TESTING_API: '1', NEXT_DIST_DIR: '.next-e2e' },
  },
});

import { instant } from '@next/playwright';
import { expect, test } from '@playwright/test';

// Seeded published sample (apps/api/prisma/seed.ts).
const SAMPLE_ID = '019ab000-0000-7000-8000-000000000002';
const SAMPLE_NAME = 'Tree height and crown width';

// From "/", opening the picker and clicking a configuration must show that
// configuration immediately: its links use prefetch={true}, so the page's
// URL-specific part (the configuration, cached per id) is prefetched once the
// picker opens (intent), instead of only the shared App Shell with a skeleton.
//
// Next.js keeps the previous page mounted but hidden after navigating, so the
// assertions only look at visible elements.
test('picker link from / to /c/[id]: the shared configuration is instant', async ({ page, baseURL }) => {
  await page.goto('/');
  await expect(page.getByTestId('config-name').filter({ visible: true })).toHaveText('Tree leaf area');

  await instant(
    page,
    async () => {
      await page.getByTestId('config-picker').click();
      await page.locator(`a[href="/c/${SAMPLE_ID}"]`).click();
      await page.waitForURL((url) => url.pathname === `/c/${SAMPLE_ID}`);

      await expect(page.getByTestId('dataset-name')).toHaveText('Landscape Trees');
      await expect(page.getByTestId('config-name').filter({ visible: true })).toHaveText(SAMPLE_NAME);
      await expect(page.getByRole('status', { name: 'Loading configuration' })).toHaveCount(0);
    },
    { baseURL },
  );

  await expect(page.getByTestId('config-name').filter({ visible: true })).toHaveText(SAMPLE_NAME);
  await expect(page.getByRole('heading', { level: 1, name: SAMPLE_NAME })).toBeVisible();
});

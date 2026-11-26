import { instant } from '@next/playwright';
import { expect, test } from '@playwright/test';

// A direct visit to "/" must paint the workspace and the default configuration
// from the prerendered shell, without waiting for anything request-time. The
// user chip reads a cookie, so it's the one part that waits for the request:
// asserting it's absent under the lock also proves the lock engaged.
test('initial load of /: header and default configuration are instant, the user chip streams in', async ({
  page,
  baseURL,
}) => {
  await instant(
    page,
    async () => {
      await page.goto('/');
      await expect(page.getByTestId('dataset-name')).toHaveText('Landscape Trees');
      await expect(page.getByTestId('config-name')).toHaveText('Tree leaf area');
      await expect(page.getByTestId('user-chip')).toHaveCount(0);
    },
    { baseURL },
  );

  await expect(page.getByTestId('user-chip')).toBeVisible();
});

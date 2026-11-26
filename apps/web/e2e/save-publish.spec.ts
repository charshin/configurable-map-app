import { expect, type Page, test } from '@playwright/test';

// The write path end to end on the production build: Save as and Publish go
// through Server Actions that expire cache tags (updateTag), so the cached
// lists and pages must show each change straight away, for the author and for
// other users. Each run uses fresh usernames, so it doesn't depend on earlier
// runs (it does leave its rows in the local database).

async function signIn(page: Page, username: string) {
  await page.getByTestId('user-chip').click();
  await page.getByRole('dialog').getByLabel('Username').fill(username);
  await page.getByRole('button', { name: /^(Sign in|Switch)$/ }).click();
  await expect(page.getByTestId('user-chip')).toContainText(username);
}

const visible = (page: Page, testId: string) => page.getByTestId(testId).filter({ visible: true });

test('save as, publish, and another user sees it', async ({ page }) => {
  const run = Date.now().toString(36);
  const author = `e2e-author-${run}`;
  const name = `E2E height ${run}`;

  await page.goto('/');
  await signIn(page, author);

  // Edit the draft: hide a column.
  await page.getByRole('tab', { name: 'Columns' }).click();
  await page.getByRole('checkbox', { name: 'Condition' }).filter({ visible: true }).click({ force: true });
  await expect(page.getByText('Unsaved', { exact: true })).toBeVisible();

  // Save as: lands on the new configuration's link, private and owned.
  await page.getByRole('button', { name: 'Save as…' }).click();
  await page.getByRole('dialog').getByLabel('Name', { exact: true }).fill(name);
  await page.getByRole('button', { name: 'Save', exact: true }).click();
  await page.waitForURL(/\/c\/[0-9a-f-]{36}$/);
  const link = new URL(page.url()).pathname;
  await expect(visible(page, 'config-name')).toHaveText(name);
  await expect(visible(page, 'visibility')).toHaveText('Private');

  // It's under Mine straight away (the owner's cached list was expired).
  await page.getByTestId('config-picker').click();
  await expect(page.getByRole('group', { name: 'Mine' }).getByRole('link', { name })).toBeVisible();
  await page.keyboard.press('Escape');

  // Publish.
  await page.getByRole('button', { name: 'Publish' }).click();
  await page.getByRole('alertdialog').getByRole('button', { name: 'Publish' }).click();
  await expect(visible(page, 'visibility')).toHaveText('Published');

  // Another user finds it under Published and can open the link.
  await signIn(page, `e2e-viewer-${run}`);
  await page.goto('/');
  await page.getByTestId('config-picker').click();
  await expect(page.getByRole('group', { name: 'Published by others' }).getByRole('link', { name })).toBeVisible();
  await page.keyboard.press('Escape');
  await page.goto(link);
  await expect(visible(page, 'config-name')).toHaveText(name);
  await expect(page.getByTestId('config-notice')).toHaveCount(0);
});

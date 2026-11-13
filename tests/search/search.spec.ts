import { test, expect } from '@playwright/test';

test.describe('Product search', () => {
  test('finds a product by name', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('search-input').fill('hub');
    await expect(page.getByTestId('result')).toHaveCount(1);
    await expect(page.getByTestId('result')).toContainText('USB-C Hub');
  });

  test('shows the empty state for an unknown query', { tag: '@regression' }, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('search-input').fill('zzzz-no-such-product');
    await expect(page.getByTestId('empty-state')).toBeVisible();
    await expect(page.getByTestId('result')).toHaveCount(0);
  });

  test('search results update as the user types', { tag: '@regression' }, async ({ page }) => {
    await page.goto('/');
    await page.getByTestId('search-input').fill('mouse');
    await expect(page.getByTestId('result')).toHaveCount(1);
  });
});

import { test, expect } from '@playwright/test';
import { addProductByName } from '../helpers/ui';

// Each test runs in a fresh browser context (no shared cookies, storage or cart), so the order
// of these two tests does not matter. Run them with --workers=1 or in parallel and the result is the same.
test.describe('Isolation between tests', () => {
  test('adding to the cart in one test', { tag: '@regression' }, async ({ page }) => {
    await page.goto('/');
    await addProductByName(page, 'USB-C Hub');
    await expect(page.getByTestId('cart-item')).toHaveCount(1);
  });

  test('a fresh context never sees another test cart', { tag: '@regression' }, async ({ page }) => {
    // Wait for the cart request so the empty state is actually loaded before we assert on it.
    await Promise.all([
      page.waitForResponse((r) => r.url().endsWith('/api/cart') && r.status() === 200),
      page.goto('/'),
    ]);
    await expect(page.getByTestId('cart-item')).toHaveCount(0);
    await expect(page.getByTestId('cart-total')).toHaveText('$0.00');
  });
});

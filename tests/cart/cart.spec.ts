import { test, expect } from '@playwright/test';
import { addProductByName } from '../helpers/ui';

test.describe('Shopping cart', () => {
  test('adds a product and shows the total', { tag: '@smoke' }, async ({ page }) => {
    await page.goto('/');
    await addProductByName(page, 'USB-C Hub');
    // 40 item + 5 shipping
    await expect(page.getByTestId('cart-total')).toHaveText('$45.00');
  });

  test('removes a product and updates the total', { tag: '@regression' }, async ({ page }) => {
    await page.goto('/');
    await addProductByName(page, 'Mechanical Keyboard');
    await addProductByName(page, 'Wireless Mouse');
    await expect(page.getByTestId('cart-total')).toHaveText('$90.00');

    await page.getByTestId('cart-item').filter({ hasText: 'Wireless Mouse' }).getByTestId('remove-item').click();

    await expect(page.getByTestId('cart-item')).toHaveCount(1);
    // 60 keyboard + 5 shipping
    await expect(page.getByTestId('cart-total')).toHaveText('$65.00');
  });

  test('applies SAVE10 discount to the cart total', { tag: '@regression' }, async ({ page }) => {
    await page.goto('/');
    await addProductByName(page, 'Mechanical Keyboard');
    await addProductByName(page, 'Wireless Mouse');

    await page.getByTestId('discount-code').fill('SAVE10');
    await page.getByTestId('apply-discount').click();
    await expect(page.getByTestId('discount-message')).toHaveText('Discount applied');

    // Expected: 10% off the 85 subtotal, plus 5 shipping = 81.50
    await expect(page.getByTestId('cart-total')).toHaveText('$81.50');
  });
});

import { test, expect } from '../fixtures';
import { addProductByName, logIn } from '../helpers/ui';

test.describe('Checkout', () => {
  test('places an order for a logged-in customer', { tag: '@smoke' }, async ({ page, user }) => {
    await logIn(page, user);
    await addProductByName(page, 'USB-C Hub');
    await page.getByTestId('shipping-address').fill('1 Main Street');
    await page.getByTestId('place-order').click();

    await expect(page.getByTestId('order-confirmation')).toBeVisible();
    await expect(page.getByTestId('order-id')).toHaveText(/^ORD-\d+$/);
  });

  test('requires a shipping address', { tag: '@regression' }, async ({ page, user }) => {
    await logIn(page, user);
    await addProductByName(page, 'USB-C Hub');
    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('checkout-error')).toHaveText('Shipping address is required');
  });

  test('does not allow checkout with an empty cart', { tag: '@regression' }, async ({ page, user }) => {
    await logIn(page, user);
    await page.getByTestId('shipping-address').fill('1 Main Street');
    await page.getByTestId('place-order').click();
    await expect(page.getByTestId('checkout-error')).toHaveText('Your cart is empty');
  });
});

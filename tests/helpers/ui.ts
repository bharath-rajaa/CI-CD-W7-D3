import { expect } from '@playwright/test';
import type { Page, Response } from '@playwright/test';

/** Fills the login form, submits it and returns the API response (so tests can assert on status codes). */
export async function submitLogin(page: Page, email: string, password: string): Promise<Response> {
  await page.getByTestId('login-email').fill(email);
  await page.getByTestId('login-password').fill(password);
  const [response] = await Promise.all([
    page.waitForResponse((r) => r.url().endsWith('/api/login') && r.request().method() === 'POST'),
    page.getByTestId('login-submit').click(),
  ]);
  return response;
}

export async function logIn(page: Page, user: { email: string; password: string }) {
  await page.goto('/');
  const response = await submitLogin(page, user.email, user.password);
  expect(response.status(), 'login should succeed').toBe(200);
  await expect(page.getByTestId('user-name')).toHaveText(user.email);
}

/** Searches for a product by name, waits for exactly one result and adds it to the cart. */
export async function addProductByName(page: Page, name: string) {
  await page.getByTestId('search-input').fill(name);
  const result = page.getByTestId('result').filter({ hasText: name });
  await expect(result).toHaveCount(1);
  await result.getByTestId('add-to-cart').click();
  await expect(page.getByTestId('cart-item').filter({ hasText: name })).toHaveCount(1);
}

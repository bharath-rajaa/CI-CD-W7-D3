import { test, expect } from '../fixtures';
import { logIn, submitLogin } from '../helpers/ui';

test.describe('Login', () => {
  test('logs in with valid credentials', { tag: '@smoke' }, async ({ page, user }) => {
    await logIn(page, user);
    await expect(page.getByTestId('logout-button')).toBeVisible();
  });

  test('shows an error for a wrong password', { tag: '@regression' }, async ({ page, user }) => {
    await page.goto('/');
    const response = await submitLogin(page, user.email, 'wrong-password');
    expect(response.status()).toBe(401);
    await expect(page.getByTestId('login-error')).toHaveText('Invalid email or password');
  });

  test('locks the account after three failed attempts', { tag: '@regression' }, async ({ page, user }) => {
    await page.goto('/');
    for (let attempt = 1; attempt <= 3; attempt++) {
      const response = await submitLogin(page, user.email, 'wrong-password');
      expect(response.status(), `failed attempt ${attempt}`).toBe(401);
    }
    const locked = await submitLogin(page, user.email, user.password);
    expect(locked.status()).toBe(423);
    await expect(page.getByTestId('login-error')).toContainText('locked');
  });
});

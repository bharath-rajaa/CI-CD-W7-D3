import { test as base, expect } from '@playwright/test';

export type TestUser = { email: string; password: string };

/**
 * Isolation: every test gets its own account, created through the API.
 * No test depends on data created by another test, so the suite can run in any order and in parallel.
 */
export const test = base.extend<{ user: TestUser }>({
  user: async ({ request }, use, testInfo) => {
    const unique = `${testInfo.workerIndex}-${testInfo.parallelIndex}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
    const user: TestUser = { email: `qa-${unique}@example.com`, password: 'Passw0rd!' };
    const res = await request.post('/api/users', { data: user });
    expect(res.status(), 'fixture user should be created').toBe(201);
    await use(user);
  },
});

export { expect };

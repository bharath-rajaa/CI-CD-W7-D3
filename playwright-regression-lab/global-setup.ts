import { request } from '@playwright/test';
import type { FullConfig } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';

/**
 * Runs once before all workers start.
 * 1. Fails fast with a clear message if the app is unhealthy (an environment problem, not a product bug).
 * 2. Resets seed data so every run starts from the same known state.
 * 3. Records run metadata used when triaging results later.
 */
export default async function globalSetup(_config: FullConfig) {
  const baseURL = process.env.BASE_URL ?? 'http://localhost:3000';
  const api = await request.newContext({ baseURL });

  const health = await api.get('/api/health');
  if (!health.ok()) {
    throw new Error(`App is not healthy at ${baseURL} (HTTP ${health.status()}). Check PORT / BASE_URL.`);
  }
  const reset = await api.post('/api/reset');
  if (!reset.ok()) throw new Error('Could not reset seed data');
  await api.dispose();

  fs.mkdirSync('reports', { recursive: true });
  fs.writeFileSync(
    path.join('reports', 'run-meta.json'),
    JSON.stringify(
      {
        startedAt: new Date().toISOString(),
        baseURL,
        node: process.version,
        ci: Boolean(process.env.CI),
        workers: process.env.WORKERS ?? 'default',
      },
      null,
      2,
    ),
  );
}

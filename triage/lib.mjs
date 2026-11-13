import { readFileSync } from 'node:fs';

export const stripAnsi = (s) => s.replace(/\x1b\[[0-9;]*m/g, '');

export function firstLine(message = '') {
  return stripAnsi(message).split('\n').map((l) => l.trim()).find(Boolean) ?? '';
}

/** Collapses a failure message to a signature: quoted values, numbers and paths are replaced by placeholders. */
export function normalize(message) {
  return firstLine(message)
    .replace(/'[^']*'|"[^"]*"/g, '<S>')
    .replace(/\$?\d[\d.,]*/g, '<N>')
    .replace(/\/[\w.-]+(?:\/[\w.-]+)*/g, '<PATH>')
    .replace(/\s+/g, ' ');
}

/** Flattens a Playwright JSON report into one row per non-passing test. */
export function collectFailures(reportPath) {
  const report = JSON.parse(readFileSync(reportPath, 'utf8'));
  const out = [];
  const walk = (suite, inheritedFile) => {
    const file = suite.file ?? inheritedFile;
    for (const spec of suite.specs ?? []) {
      for (const test of spec.tests ?? []) {
        if (test.status === 'expected' || test.status === 'skipped') continue;
        const results = test.results ?? [];
        const failed = results.filter((r) => r.status === 'failed' || r.status === 'timedOut');
        out.push({
          title: spec.title,
          file,
          project: test.projectName,
          status: test.status, // unexpected | flaky
          tags: spec.tags ?? test.tags ?? [],
          retries: Math.max(0, results.length - 1),
          message: failed.at(-1)?.error?.message ?? '(no error message recorded)',
        });
      }
    }
    for (const child of suite.suites ?? []) walk(child, file);
  };
  for (const s of report.suites ?? []) walk(s, undefined);
  return out;
}

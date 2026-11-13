import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { collectFailures, firstLine } from './lib.mjs';
import { classify } from './rules.mjs';

const input = process.argv[2] ?? 'reports/results.json';
if (!existsSync(input)) {
  console.error(`No Playwright JSON report at ${input}. Run "npm test" first.`);
  process.exit(1);
}

const ACTIONS = {
  product_bug: 'Raise a defect with repro steps and the trace attached',
  test_bug: 'Fix the test (wait or assert correctly). Do not change the app',
  environment: 'Check server, port and config, then rerun',
  data: 'Fix seeding, or make the test create its own data',
  needs_review: 'Human review required',
};
const PRIORITY_ORDER = { P1: 0, P2: 1, P3: 2 };
const CATEGORY_ORDER = { environment: 0, product_bug: 1, data: 2, test_bug: 3, needs_review: 4 };

const rows = collectFailures(input).map((f) => {
  // P1: smoke failures and anything blocking the whole run. P2: regression failures. P3: flaky.
  let priority = f.tags.includes('@smoke') ? 'P1' : 'P2';
  if (f.status === 'flaky') priority = 'P3';
  const verdict = classify(f.message);
  if (verdict.category === 'environment') priority = 'P1';
  return { ...f, priority, ...verdict, evidence: firstLine(f.message), action: ACTIONS[verdict.category] };
});

rows.sort(
  (a, b) =>
    PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority] ||
    CATEGORY_ORDER[a.category] - CATEGORY_ORDER[b.category] ||
    a.title.localeCompare(b.title),
);

mkdirSync('reports', { recursive: true });
writeFileSync('reports/triage.json', JSON.stringify(rows, null, 2));

const esc = (s) => String(s).replace(/\|/g, '\\|');
const md = [
  '# Failure triage',
  '',
  `Source: \`${input}\`. Failing tests: ${rows.length}.`,
  '',
  '| Priority | Test | Project | Status | Proposed category | Evidence | Suggested action |',
  '|---|---|---|---|---|---|---|',
  ...rows.map(
    (r) =>
      `| ${r.priority} | ${esc(r.title)} | ${r.project} | ${r.status} | ${r.category} (${r.confidence}) | ${esc(r.evidence)} | ${esc(r.action)} |`,
  ),
  '',
  'Categories are proposals from rules. Confirm each one by opening the trace before raising a defect or changing a test.',
  '',
];
writeFileSync('reports/triage-report.md', md.join('\n'));

if (rows.length === 0) {
  console.log('No failures. Nothing to triage.');
} else {
  console.log(`\n${rows.length} failing test(s), ordered by priority:\n`);
  for (const r of rows) {
    console.log(`${r.priority}  ${r.category.padEnd(13)} [${r.project}] ${r.title}`);
    console.log(`      ${r.evidence}`);
  }
}
console.log('\nWritten: reports/triage-report.md, reports/triage.json');

// Runtime analysis: where does the time go, and how much did parallelism save?
import { existsSync, readFileSync } from 'node:fs';

const input = process.argv[2] ?? 'reports/results.json';
if (!existsSync(input)) {
  console.error(`No report at ${input}. Run "npm test" first.`);
  process.exit(1);
}
const report = JSON.parse(readFileSync(input, 'utf8'));
const rows = [];

const walk = (suite) => {
  for (const spec of suite.specs ?? []) {
    for (const test of spec.tests ?? []) {
      const ms = (test.results ?? []).reduce((sum, r) => sum + (r.duration ?? 0), 0);
      rows.push({ title: spec.title, project: test.projectName, tags: (spec.tags ?? []).join(' ') || '-', status: test.status, ms });
    }
  }
  for (const child of suite.suites ?? []) walk(child);
};
(report.suites ?? []).forEach(walk);
rows.sort((a, b) => b.ms - a.ms);

const summed = rows.reduce((s, r) => s + r.ms, 0);
const wall = report.stats?.duration ?? 0;
console.log(`Tests executed: ${rows.length}`);
console.log(`Summed test time: ${(summed / 1000).toFixed(1)}s   Wall-clock: ${(wall / 1000).toFixed(1)}s`);
if (wall) console.log(`Parallel speed-up factor (approx.): ${(summed / wall).toFixed(2)}x`);

console.log('\nSlowest 5:');
for (const r of rows.slice(0, 5)) console.log(`  ${(r.ms / 1000).toFixed(2)}s  [${r.project}] ${r.title} (${r.status})`);

const byTag = {};
for (const r of rows) {
  for (const tag of r.tags === '-' ? ['untagged'] : r.tags.split(' ')) byTag[tag] = (byTag[tag] ?? 0) + r.ms;
}
console.log('\nTime by tag (a test counts toward every tag it carries):');
for (const [tag, ms] of Object.entries(byTag)) console.log(`  ${tag}: ${(ms / 1000).toFixed(1)}s`);

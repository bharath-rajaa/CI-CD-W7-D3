import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { collectFailures, normalize } from './lib.mjs';

const input = process.argv[2] ?? 'reports/results.json';
if (!existsSync(input)) {
  console.error(`No report at ${input}. Run "npm test" first.`);
  process.exit(1);
}

// Deterministic baseline: group failures whose normalised first line is identical.
const groups = new Map();
for (const f of collectFailures(input)) {
  const sig = normalize(f.message);
  if (!groups.has(sig)) groups.set(sig, []);
  groups.get(sig).push(f.title);
}
const clusters = [...groups].map(([signature, tests], i) => ({ id: `H${i + 1}`, signature, tests }));

mkdirSync('reports', { recursive: true });
writeFileSync('reports/clusters.json', JSON.stringify({ method: 'heuristic-signature', clusters }, null, 2));

console.log(`Heuristic clusters: ${clusters.length}`);
for (const c of clusters) {
  console.log(`\n${c.id}  ${c.signature}`);
  for (const t of c.tests) console.log(`     - ${t}`);
}
console.log('\nWritten: reports/clusters.json');

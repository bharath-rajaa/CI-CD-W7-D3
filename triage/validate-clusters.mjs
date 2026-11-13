// Measures how well a clustering matches the human-labelled root causes in triage/labels.json.
// Pairwise precision: of the pairs placed together, how many really share a root cause (over-merging hurts this).
// Pairwise recall:    of the pairs that share a root cause, how many were placed together (over-splitting hurts this).
// Purity:             share of tests that sit with their cluster's majority root cause.
import { existsSync, readFileSync } from 'node:fs';

const threshold = Number(process.argv.find((a) => a.startsWith('--min-purity='))?.split('=')[1] ?? 0.9);
const labels = JSON.parse(readFileSync('triage/labels.json', 'utf8'));

if (!existsSync('reports/clusters.json')) {
  console.error('Run "npm run cluster" first (reports/clusters.json is missing).');
  process.exit(1);
}
const load = (p) => JSON.parse(readFileSync(p, 'utf8'));

function evaluate(name, set) {
  const assign = new Map();
  for (const c of set.clusters) for (const t of c.tests) assign.set(t, c.id);

  const labelled = Object.keys(labels).filter((t) => assign.has(t));
  const missing = Object.keys(labels).filter((t) => !assign.has(t));

  let tp = 0, fp = 0, fn = 0;
  for (let i = 0; i < labelled.length; i++) {
    for (let j = i + 1; j < labelled.length; j++) {
      const a = labelled[i], b = labelled[j];
      const sameLabel = labels[a] === labels[b];
      const sameCluster = assign.get(a) === assign.get(b);
      if (sameLabel && sameCluster) tp++;
      else if (!sameLabel && sameCluster) fp++;
      else if (sameLabel && !sameCluster) fn++;
    }
  }

  const groups = {};
  for (const t of labelled) (groups[assign.get(t)] ??= []).push(labels[t]);
  let majority = 0;
  const overMerged = [];
  for (const [id, ls] of Object.entries(groups)) {
    const counts = {};
    for (const l of ls) counts[l] = (counts[l] ?? 0) + 1;
    majority += Math.max(...Object.values(counts));
    if (Object.keys(counts).length > 1) overMerged.push(`${id} mixes ${Object.keys(counts).join(' + ')}`);
  }

  return {
    name,
    purity: labelled.length ? majority / labelled.length : 0,
    precision: tp + fp ? tp / (tp + fp) : 1,
    recall: tp + fn ? tp / (tp + fn) : 1,
    overMerged,
    missing,
  };
}

const aiPath = existsSync('reports/ai-clusters.json') ? 'reports/ai-clusters.json' : 'triage/ai-clusters.sample.json';
const heuristic = evaluate('heuristic (signature)', load('reports/clusters.json'));
const ai = evaluate(`AI-assisted (${aiPath})`, load(aiPath));

for (const r of [heuristic, ai]) {
  console.log(`\n${r.name}`);
  console.log(`  purity=${r.purity.toFixed(2)}  pairwise precision=${r.precision.toFixed(2)}  recall=${r.recall.toFixed(2)}`);
  for (const o of r.overMerged) console.log(`  over-merge: ${o}`);
  for (const m of r.missing) console.log(`  not clustered: ${m}`);
}

const failed = ai.purity < threshold || ai.missing.length > 0;
if (failed) {
  console.error(`\nFAIL: AI-assisted clustering purity ${ai.purity.toFixed(2)} is below ${threshold} or has unclustered failures.`);
  process.exit(1);
}
console.log(`\nPASS: AI-assisted clustering meets purity >= ${threshold} on the labelled failures.`);

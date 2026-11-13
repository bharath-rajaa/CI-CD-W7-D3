// AI-assisted clustering: asks a Claude model to group failures by probable root cause.
// Needs ANTHROPIC_API_KEY. Without it, the script exits and validate-clusters uses the sample output.
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { collectFailures } from './lib.mjs';

const input = process.argv[2] ?? 'reports/results.json';
const key = process.env.ANTHROPIC_API_KEY;
if (!key) {
  console.log('ANTHROPIC_API_KEY is not set. Skipping. validate-clusters will use triage/ai-clusters.sample.json.');
  process.exit(0);
}
if (!existsSync(input)) {
  console.error(`No report at ${input}. Run "npm test" first.`);
  process.exit(1);
}

const model = process.env.AI_MODEL ?? 'claude-haiku-5-5';
const failures = collectFailures(input).map(({ title, tags, message }) => ({
  title,
  tags,
  message: message.slice(0, 800),
}));

const prompt = `You group Playwright test failures by probable ROOT CAUSE.
Use the test title, tags and error message. Do not merge failures that have different root causes,
even if their error messages look alike. Return ONLY JSON, no prose, no Markdown fences, in this shape:
{"clusters":[{"id":"string","label":"short root-cause description","tests":["exact test title"]}]}

Failures:
${JSON.stringify(failures, null, 2)}`;

const res = await fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01' },
  body: JSON.stringify({ model, max_tokens: 1500, messages: [{ role: 'user', content: prompt }] }),
});
if (!res.ok) throw new Error(`API error ${res.status}: ${await res.text()}`);

const data = await res.json();
const text = data.content.map((b) => b.text ?? '').join('').replace(/```json|```/g, '').trim();
const parsed = JSON.parse(text);

mkdirSync('reports', { recursive: true });
writeFileSync('reports/ai-clusters.json', JSON.stringify({ method: 'llm-assisted', model, ...parsed }, null, 2));
console.log(`AI clusters: ${parsed.clusters.length}. Written: reports/ai-clusters.json`);
console.log('Review them against the traces before trusting them. Then run: npm run validate:clusters');

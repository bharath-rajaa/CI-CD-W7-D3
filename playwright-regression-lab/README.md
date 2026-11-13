# Playwright Regression Lab

A small, runnable Playwright project for the regression-testing topics below. It tests a demo shop (`app/`) that is included, so everything runs offline. The app contains seeded defects, so the triage lab has real failures to analyse.

| Syllabus topic | Where it lives |
|---|---|
| Group tests by feature, risk, tags, smoke/regression purpose, runtime | `tests/<feature>/`, `@smoke` / `@regression` tags, `npm run runtime` |
| Parallel execution and isolation | `playwright.config.ts` (`fullyParallel`, workers), `tests/fixtures.ts`, `tests/isolation/` |
| Triage product bugs, test bugs, environment issues and data problems | `triage/rules.mjs`, `triage/triage.mjs`, `reports/triage-report.md` |
| Validate AI-assisted failure clustering | `triage/cluster.mjs`, `triage/ai-cluster.mjs`, `triage/validate-clusters.mjs` |
| Hands-on lab: run a regression suite and prioritise failures | "Lab tasks" below |

## Quick start

Requires Node.js 18 or later.

```bash
npm install
npx playwright install chromium   # one-off browser download
npm test                          # full suite (Playwright starts the app automatically)
npm run triage                    # classify and prioritise failures
npm run cluster                   # heuristic failure clusters
npm run validate:clusters         # score clustering against labelled root causes
```

Open the HTML report with `npm run report`.

## Test organisation

Tests are grouped by feature folder. Each test carries a purpose tag:

- `@smoke`: fast, critical-path checks. They also run on the `mobile-chrome` project.
- `@regression`: broader behaviour checks, including edge cases and past bugs.

Selectors use `data-testid` attributes, which keeps tests stable when styling or copy changes.

| Command | What it runs |
|---|---|
| `npm run test:smoke` | `@smoke` only (about 30 seconds) |
| `npm run test:regression` | `@smoke` and `@regression` (the full suite) |
| `npm run runtime` | Runtime breakdown from the last run: slowest tests, time per tag, parallel speed-up |

The suite is intentionally small. In a real project, add a `@slow` tag for long end-to-end flows and exclude it from pull-request runs with `--grep-invert @slow`.

## Parallel execution and isolation

- `fullyParallel: true` lets every test in every file run on any worker.
- Each test gets a new browser context, so cookies, storage and cart state never leak between tests. `tests/isolation/` shows this.
- Each test that needs an account creates its own user through the API (`user` fixture). Nothing depends on a pre-existing account except the documented seed user, which no test mutates.
- `global-setup.ts` checks the app's health and resets seed data once before the run.

Compare the modes:

```bash
npm run test:isolated   # 1 worker: slowest, easiest to read logs from
npm run test:parallel   # 4 workers: faster, shows any hidden shared state
npm run runtime         # prints the parallel speed-up factor
```

If a test passes alone but fails in parallel, it probably shares state. Fix the test. Do not add `test.describe.configure({ mode: 'serial' })` to hide the problem.

## Triage workflow

`npm run triage` reads `reports/results.json` and classifies every failing test:

| Category | Typical evidence | Action |
|---|---|---|
| `product_bug` | Assertion fails on a value the app computed | Raise a defect with trace and repro steps |
| `test_bug` | Locator resolves to several elements or times out; assertion read before the app settles | Fix the test. Do not change the app |
| `environment` | `ECONNREFUSED`, server not available, port in use | Check the server, port and config, then rerun |
| `data` | `409 already exists`, missing seed user | Fix seeding, or have the test create its own data |
| `needs_review` | No rule matched | A person decides |

Priorities: **P1** smoke failures and environment failures (they block everything), **P2** regression failures, **P3** flaky tests (failed, then passed on retry).

Rules are deliberately simple. They propose a category and a confidence level. A person checks the trace before acting. Some failures are ambiguous from the message alone: for example, a stale assertion and a real product bug can produce the same `Expected / Received` text.

## Failure clustering and how to validate it

`npm run cluster` groups failures whose normalised error first line is identical. This is cheap and deterministic, but it merges unrelated causes that produce similar messages.

`npm run cluster:ai` asks a Claude model to group failures by probable root cause. It needs `ANTHROPIC_API_KEY`, and it writes `reports/ai-clusters.json`. Without a key, the sample output in `triage/ai-clusters.sample.json` is used.

AI output is not accepted on trust. `npm run validate:clusters` compares each clustering with the human-labelled root causes in `triage/labels.json`:

- **Purity**: the share of tests that sit with their cluster's majority root cause.
- **Pairwise precision**: when two tests share a cluster, do they really share a root cause? Low precision means over-merging.
- **Pairwise recall**: when two tests share a root cause, are they in the same cluster? Low recall means over-splitting.

The script exits non-zero when the AI-assisted clustering falls below `--min-purity` (default 0.9), so it can act as a CI gate.

## Hands-on lab tasks

1. **Run and read.** Run `npm run test:smoke`, then `npm run test:regression`. Record how many tests fail and which ones. Open one failing trace (`npm run report`) and describe what the app did.
2. **Runtime.** Run `npm run runtime`. Which test is slowest? Compare the parallel speed-up with `npm run test:isolated`. Explain why the speed-up is not the full worker count.
3. **Triage.** Run `npm run triage` and open `reports/triage-report.md`. For each failure, confirm or correct the proposed category using the trace. Then rank the failures for follow-up and justify the order in writing.
4. **Environment failure.** Stop any running server on port 3000 and start the suite with `CI=1 npm test`. Run `npm run triage` and check the category. Then try `PORT`/`BASE_URL` with a wrong port. Explain how to tell the two cases apart.
5. **Data failure.** In `tests/fixtures.ts`, change the fixture email to `alice@example.com` and rerun the login tests. Triage the result. Then revert the change and explain why isolated data prevents this.
6. **Test bug.** The test `search results update as the user types` is wrong. Fix it so it waits for the result (use `toHaveCount`). Rerun and confirm it passes. Explain why this fix is a test change, not a product change.
7. **Clustering.** Run `npm run cluster` and `npm run validate:clusters`. Explain why the heuristic over-merges. Run `npm run cluster:ai` with an API key if you have one, then validate that output too. Write down one failure mode you would look for in AI-generated clusters.

## Instructor notes

`app/server.js` contains three seeded defects. Their root causes are recorded in `triage/labels.json`, so keep that file out of the learner copy until the lab is done.

- **PB-001** (product bug): the discount is applied to subtotal plus shipping.
- **PB-002** (product bug): the cart total is not refreshed after an item is removed.
- **TB-001** (test bug): the search test reads the result count before the debounced search finishes.

To check the lab, run the suite once. Three tests should fail, and all three should appear in `reports/triage-report.md`. Without the seeded defects, nothing should fail.

## Troubleshooting

- **"App is not healthy" or a webServer timeout:** another process may be using the port. Set `PORT`/`BASE_URL` to a free port, or stop the process.
- **Browser not found:** run `npx playwright install chromium`.
- **Stale reports:** `triage`, `cluster` and `runtime` read `reports/results.json`. Run `npm test` again first.

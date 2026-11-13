// First matching rule wins. Rules only PROPOSE a category; a person confirms it before a defect is raised.
const RULES = [
  {
    category: 'environment',
    confidence: 'high',
    reason: 'Connection or server-startup error',
    pattern: /ECONNREFUSED|ERR_CONNECTION_REFUSED|net::ERR_|EADDRINUSE|webServer|is not available|browser has been closed/i,
  },
  {
    category: 'data',
    confidence: 'medium',
    reason: 'Test data already exists, is missing or is in an unexpected state',
    pattern: /already exists|\b409\b|duplicate|no such user|fixture user/i,
  },
  {
    category: 'test_bug',
    confidence: 'medium',
    reason: 'Locator or wait problem inside the test',
    pattern: /strict mode violation|resolved to \d+ elements|waiting for (getByTestId|locator)/i,
  },
  {
    category: 'product_bug',
    confidence: 'low',
    reason: 'Assertion mismatch: could be a product defect or a stale expectation',
    pattern: /Expected[\s\S]*Received|toHaveText|toHaveCount|toBe\(/,
  },
];

export function classify(message) {
  const hit = RULES.find((r) => r.pattern.test(message));
  if (!hit) return { category: 'needs_review', confidence: 'none', reason: 'No rule matched' };
  return { category: hit.category, confidence: hit.confidence, reason: hit.reason };
}

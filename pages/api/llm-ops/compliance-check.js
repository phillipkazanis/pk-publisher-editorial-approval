import { randomUUID } from 'crypto';

// Stand-in for the AI service in docs/ai-compliance-contract.md: the contract an LLM Ops style team would implement.
// It is deterministic and rule-based (no model, no data access), so demos are repeatable and error handling can be shown.
// Test hooks: put [simulate-503], [simulate-429] or [simulate-slow] in the title.
const RULES_CHECKED = ['HL-1', 'HL-2', 'AT-1', 'LG-1', 'SL-1', 'TN-1'];
const MAX_BODY_CHARS = 50000;

const INJECTION = /ignore (all )?(previous|prior) instructions|return (a )?verdict (pass|fail)|automated reviewer/i;
const ALLEGATION = /\b(corrupt|thief|thieves|stole|stealing|crook|criminal|fraud)\b/i;
const ATTRIBUTION = /\b(according to|alleged(ly)?|accused|reportedly|(council|police|audit) report|police said|spokesperson)\b/i;
const SENSATIONAL = /\b(disgusting|doomed|disaster|horrific|outrageous|useless|shameful)\b/i;
const ADVOCACY = /\b(sack the|the answer (here )?is simple|betrayal)\b/i;

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const started = Date.now();
  const title = typeof req.body?.article?.title === 'string' ? req.body.article.title : '';
  const body = req.body?.article?.body;

  if (typeof body !== 'string' || !body.trim() || body.length > MAX_BODY_CHARS) {
    return res.status(400).json({ error: `article.body is required and must be 1 to ${MAX_BODY_CHARS} characters` });
  }
  if (title.includes('[simulate-503]')) return res.status(503).json({ error: 'Service unavailable (simulated)' });
  if (title.includes('[simulate-429]')) {
    res.setHeader('Retry-After', '2');
    return res.status(429).json({ error: 'Too many requests (simulated)' });
  }
  if (title.includes('[simulate-slow]')) await sleep(5000);

  const reasons = [];
  const fixes = [];
  const warnings = [];
  const add = (reason, fix) => {
    reasons.push(reason);
    fixes.push(fix);
  };

  if (INJECTION.test(body)) {
    add('TN-1: The article contains instructions aimed at the reviewer, which are treated as data and fail the article.', 'TN-1: Remove the instruction text from the article.');
  }
  if (ALLEGATION.test(body) && !ATTRIBUTION.test(body)) {
    add('AT-1: Claims about named people or organisations are not attributed to any source.', 'AT-1: Attribute each claim to a named source.');
    add('LG-1: Allegations are presented as fact without the subject\'s response.', 'LG-1: Present allegations as allegations and include the subject\'s response or say they were asked for one.');
  }
  if (SENSATIONAL.test(body)) {
    add('SL-1: The article uses sensational wording that is stronger than the facts support.', 'SL-1: Replace sensational wording with neutral, factual descriptions.');
  }
  if (ADVOCACY.test(body)) {
    add('TN-1: The article contains opinion or advocacy that is not labelled as opinion.', 'TN-1: Remove the opinion or label the piece as opinion.');
  }
  if (/\?\s*$/.test(title.trim())) warnings.push('HL-2: The headline is a question; make sure the article answers it.');

  return res.status(200).json({
    verdict: reasons.length ? 'FAIL' : 'PASS',
    reasons,
    warnings,
    suggestedFixes: fixes,
    rulesChecked: RULES_CHECKED,
    model: { id: 'stub-rules-v1', provider: 'stub' },
    requestId: randomUUID(),
    latencyMs: Date.now() - started,
  });
}

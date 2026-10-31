// Pure helpers for the Editor tasks view. No network, no React: everything here works on the task fields the
// /api/tasks route already returns, and invents nothing.
//
// What the data does and does not contain (docs/ai-compliance-contract.md):
//  - the DMN result is only { verdict, reason }; banned terms exist only inside the reason text
//  - AI findings are plain strings (reasons, warnings, claimsNeedingSources); there is no severity or excerpt field
// So severity is derived from which list a finding is in, and text is highlighted only when a finding is, or quotes,
// an exact passage of the article.

const MIN_EXCERPT = 4;
const QUOTED = /“([^”]+)”|"([^"]+)"/g;

// The DMN reason for a banned-term failure is: "Article contains banned terms: a, b".
export function parseBannedTerms(reason) {
  if (typeof reason !== 'string') return [];
  const m = reason.match(/banned terms?:\s*(.+)$/i);
  if (!m) return [];
  return m[1].split(',').map((s) => s.trim().replace(/\.$/, '')).filter(Boolean);
}

// Exact passages of the article that a finding points at: the whole finding (with or without its closing full stop)
// or any quoted phrase inside it. Case-sensitive on purpose, so nothing is highlighted on a guess.
export function excerptsIn(finding, body) {
  if (typeof finding !== 'string' || typeof body !== 'string') return [];
  const found = [];
  const add = (s) => {
    const t = s.trim();
    if (t.length >= MIN_EXCERPT && body.includes(t) && !found.includes(t)) found.push(t);
  };
  const whole = finding.trim();
  if (body.includes(whole)) add(whole);
  else add(whole.replace(/[.…\s]+$/, ''));
  for (const m of finding.matchAll(QUOTED)) add(m[1] ?? m[2]);
  return found;
}

// Splits the body into plain-text segments, marking the ranges covered by any excerpt. Overlaps are merged.
export function highlightSegments(body, excerpts) {
  if (typeof body !== 'string' || !body) return [];
  const ranges = [];
  for (const ex of new Set(excerpts || [])) {
    if (!ex) continue;
    let i = body.indexOf(ex);
    while (i !== -1) {
      ranges.push([i, i + ex.length]);
      i = body.indexOf(ex, i + ex.length);
    }
  }
  if (!ranges.length) return [{ text: body, mark: false }];
  ranges.sort((a, b) => a[0] - b[0]);
  const merged = [ranges[0].slice()];
  for (const [s, e] of ranges.slice(1)) {
    const last = merged[merged.length - 1];
    if (s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const out = [];
  let pos = 0;
  for (const [s, e] of merged) {
    if (s > pos) out.push({ text: body.slice(pos, s), mark: false });
    out.push({ text: body.slice(s, e), mark: true });
    pos = e;
  }
  if (pos < body.length) out.push({ text: body.slice(pos), mark: false });
  return out;
}

// One list of AI findings, most serious first. kind: reason (must fix), warning (advisory), claim (check the source).
export function aiFindings(task) {
  const body = task.articleBody;
  const make = (kind, list) =>
    (list || []).map((text, i) => {
      const excerpts = excerptsIn(text, body);
      return { id: `${kind}${i}`, kind, text, excerpts, matched: excerpts.length > 0 };
    });
  return [...make('reason', task.aiReasons), ...make('warning', task.aiWarnings), ...make('claim', task.claimsNeedingSources)];
}

// 'pass' | 'fail' | 'other' (present but not recognised, shown as written) | 'none'
export function aiVerdictKind(verdict) {
  if (typeof verdict !== 'string' || !verdict.trim()) return 'none';
  if (/^\s*PASS/i.test(verdict)) return 'pass';
  if (/^\s*FAIL/i.test(verdict)) return 'fail';
  return 'other';
}

// The chip in the task list. Claims with no named source are informational and do not count as "needs attention".
export function taskStatus(task) {
  const ai = aiVerdictKind(task.aiVerdict);
  const rulesOk = !task.rulesVerdict || task.rulesVerdict === 'PASS';
  if (ai === 'none' && !task.rulesVerdict) return { key: 'none', label: 'No check result' };
  if (ai === 'pass' && rulesOk && !(task.aiReasons || []).length && !(task.aiWarnings || []).length) return { key: 'pass', label: 'AI PASS' };
  return { key: 'attention', label: 'Needs attention' };
}

// Word count against the limits the DMN enforces (from /api/limits). 'ok' | 'over' | 'under' | 'unknown'
export function wordCountState(words, limits) {
  if (!Number.isFinite(words)) return 'unknown';
  if (limits?.maxWordCount && words > limits.maxWordCount) return 'over';
  if (limits?.minWordCount && words < limits.minWordCount) return 'under';
  return limits && (limits.maxWordCount || limits.minWordCount) ? 'ok' : 'unknown';
}

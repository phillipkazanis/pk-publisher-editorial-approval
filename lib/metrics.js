// Business metrics from the app's Supabase mirror of each submission. A pure function, so it can be tested without a database.
// The engine's own history (Operate) is the system of record; this is the same story in one glance.
const TEST_PREFIX = 'smoke-test-';

const round1 = (n) => Math.round(n * 10) / 10;
const pct = (n, d) => (d ? round1((100 * n) / d) : null);
const sum = (xs) => xs.reduce((a, b) => a + b, 0);

function median(sorted) {
  if (!sorted.length) return null;
  const mid = sorted.length / 2;
  return sorted.length % 2 ? sorted[(sorted.length - 1) / 2] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function computeMetrics(submissions, notifications) {
  const real = submissions.filter((s) => !String(s.submission_id).startsWith(TEST_PREFIX));
  const ids = new Set(real.map((s) => s.submission_id));

  const rounds = {}; // revision requests sent per submission
  for (const n of notifications) if (ids.has(n.submission_id)) rounds[n.submission_id] = (rounds[n.submission_id] || 0) + 1;

  const byStatus = {};
  for (const s of real) byStatus[s.status] = (byStatus[s.status] || 0) + 1;

  const published = real.filter((s) => s.status === 'published');
  const abandoned = byStatus.abandoned || 0;
  const revised = real.filter((s) => (rounds[s.submission_id] || 0) > 0);
  const firstPass = published.filter((s) => !rounds[s.submission_id]).length;

  // updated_at is the last change, which for a published article is the publish. This includes time spent waiting for people.
  const minutes = published
    .map((s) => (Date.parse(s.updated_at) - Date.parse(s.created_at)) / 60000)
    .filter((m) => Number.isFinite(m) && m >= 0)
    .sort((a, b) => a - b);

  return {
    total: real.length,
    byStatus,
    inReview: (byStatus.submitted || 0) + (byStatus.resubmitted || 0),
    awaitingRevision: byStatus.revision_requested || 0,
    published: published.length,
    abandoned,
    firstPassRatePct: pct(firstPass, published.length),
    needingRevisionPct: pct(revised.length, real.length),
    avgRevisionRounds: revised.length ? round1(sum(revised.map((s) => rounds[s.submission_id])) / revised.length) : null,
    abandonmentRatePct: pct(abandoned, abandoned + published.length),
    medianMinutesToPublish: minutes.length ? round1(median(minutes)) : null,
    avgPublishAttempts: published.length ? round1(sum(published.map((s) => s.publish_attempts || 0)) / published.length) : null,
    retriedBeforePublishPct: pct(published.filter((s) => (s.publish_attempts || 0) > 1).length, published.length),
  };
}

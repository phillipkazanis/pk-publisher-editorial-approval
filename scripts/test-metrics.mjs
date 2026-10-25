// Unit test for lib/metrics.js with synthetic rows (no database, no network). Run: npm run test:metrics
import assert from 'node:assert/strict';
import { computeMetrics } from '../lib/metrics.js';

const t = (min) => new Date(Date.UTC(2026, 9, 25, 0, min)).toISOString();
const row = (id, status, startMin, endMin, attempts = 0) => ({ submission_id: id, status, created_at: t(startMin), updated_at: t(endMin), publish_attempts: attempts });

const submissions = [
  row('a', 'published', 0, 10, 2), // first pass, 10 min, retried publish
  row('b', 'published', 0, 30, 2), // revised once, 30 min
  row('c', 'published', 0, 50, 1), // revised twice, 50 min, no retry
  row('d', 'revision_requested', 0, 5),
  row('e', 'submitted', 0, 1),
  row('f', 'resubmitted', 0, 2),
  row('g', 'abandoned', 0, 99),
  row('smoke-test-x', 'published', 0, 1, 2), // test rows must be ignored
];
const notifications = [
  { submission_id: 'b' }, { submission_id: 'c' }, { submission_id: 'c' }, { submission_id: 'd' }, { submission_id: 'g' },
  { submission_id: 'smoke-test-x' }, { submission_id: 'unknown-id' },
];

const m = computeMetrics(submissions, notifications);
assert.equal(m.total, 7, 'test rows are excluded');
assert.deepEqual(m.byStatus, { published: 3, revision_requested: 1, submitted: 1, resubmitted: 1, abandoned: 1 });
assert.equal(m.inReview, 2);
assert.equal(m.awaitingRevision, 1);
assert.equal(m.published, 3);
assert.equal(m.firstPassRatePct, 33.3, '1 of 3 published had no revision');
assert.equal(m.needingRevisionPct, 57.1, '4 of 7 had a revision request (b, c, d, g)');
assert.equal(m.avgRevisionRounds, 1.3, 'rounds 1+2+1+1 over 4 revised articles');
assert.equal(m.abandonmentRatePct, 25, '1 abandoned of 4 finished');
assert.equal(m.medianMinutesToPublish, 30);
assert.equal(m.avgPublishAttempts, 1.7);
assert.equal(m.retriedBeforePublishPct, 66.7);

// Empty and odd input never throws and never divides by zero
const empty = computeMetrics([], []);
assert.equal(empty.total, 0);
assert.equal(empty.firstPassRatePct, null);
assert.equal(empty.medianMinutesToPublish, null);
const odd = computeMetrics([{ submission_id: 'z', status: 'published', created_at: 'bad', updated_at: 'worse', publish_attempts: null }], []);
assert.equal(odd.medianMinutesToPublish, null, 'unparseable timestamps are ignored');

console.log('metrics tests passed');

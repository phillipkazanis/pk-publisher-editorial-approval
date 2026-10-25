// Local smoke test for the app's API routes. Run with `npm run dev` in another terminal, then `npm run smoke`.
//
// Writes only rows whose submission_id starts with smoke-test- and deletes them at the end,
// even when a check fails. It never touches real submission IDs and never prints env values.
// Skips /api/start-process and /api/resubmit on purpose: they call the Camunda cluster.

const BASE_URL = process.env.SMOKE_BASE_URL || 'http://localhost:3000';
const PREFIX = 'smoke-test-';
const REQUIRED = ['SUPABASE_URL', 'SUPABASE_SERVICE_ROLE_KEY'];

const missing = REQUIRED.filter((name) => !process.env[name]);
if (missing.length) {
  console.error(`Missing environment variables: ${missing.join(', ')}`);
  console.error('Add them to .env.local (git-ignored) and run via `npm run smoke`.');
  process.exit(2);
}

const SCHEMA = 'demo_publisher_approval';
const runId = `${PREFIX}${Date.now()}`;
const publishId = `${runId}-publish`;
const notifyId = `${runId}-notify`;

function assertTestId(id) {
  if (typeof id !== 'string' || !id.startsWith(PREFIX)) {
    throw new Error(`Refusing to touch a non-test submission_id: ${String(id).slice(0, 12)}...`);
  }
  return id;
}

async function sb(path, opts = {}) {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const res = await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    ...opts,
    headers: {
      apikey: key,
      Authorization: `Bearer ${key}`,
      'Content-Type': 'application/json',
      'Accept-Profile': SCHEMA,
      'Content-Profile': SCHEMA,
      Prefer: 'return=representation',
    },
  });
  if (!res.ok) throw new Error(`Supabase ${opts.method || 'GET'} ${path.split('?')[0]} failed: ${res.status}`);
  const text = await res.text();
  return text ? JSON.parse(text) : [];
}

const post = (path, body) =>
  fetch(`${BASE_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });

let failures = 0;
function check(name, ok, detail = '') {
  console.log(`${ok ? 'PASS' : 'FAIL'}  ${name}${ok || !detail ? '' : ` (${detail})`}`);
  if (!ok) failures++;
}

async function seed(id) {
  await sb('submissions', {
    method: 'POST',
    body: JSON.stringify({ submission_id: assertTestId(id), article_title: '[SMOKE TEST] do not use', word_count: 0, status: 'smoke_test' }),
  });
}

async function cleanup() {
  for (const id of [publishId, notifyId]) {
    try {
      assertTestId(id);
      await sb(`notifications?submission_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
      await sb(`submissions?submission_id=eq.${encodeURIComponent(id)}`, { method: 'DELETE' });
    } catch (e) {
      failures++;
      console.error(`CLEANUP FAILED for ${id}: ${e.message}. Delete rows with submission_id starting "${PREFIX}" manually.`);
    }
  }
}

async function run() {
  // 1. Form page loads
  const page = await fetch(`${BASE_URL}/`);
  const html = await page.text();
  check('GET / returns the submission form', page.status === 200 && html.includes('Editorial submission'), `status ${page.status}`);

  // 2. Mock CMS publish: first attempt fails, second succeeds
  await seed(publishId);
  const first = await post('/api/mock-cms/publish', { submissionId: publishId });
  check('mock publish attempt 1 fails with HTTP 500', first.status === 500, `status ${first.status}`);
  const second = await post('/api/mock-cms/publish', { submissionId: publishId });
  const secondBody = await second.json().catch(() => ({}));
  check('mock publish attempt 2 succeeds', second.status === 200 && secondBody.published === true && secondBody.attempts === 2, `status ${second.status}`);
  const [pubRow] = await sb(`submissions?submission_id=eq.${encodeURIComponent(publishId)}&select=status,publish_attempts`);
  check('submission row shows published after 2 attempts', pubRow?.status === 'published' && pubRow?.publish_attempts === 2);

  // 3. Missing submissionId is rejected
  const bad = await post('/api/mock-cms/publish', {});
  check('mock publish rejects a missing submissionId (400)', bad.status === 400, `status ${bad.status}`);

  // 3b. Status route behind the status strip: returns only the status
  const stRes = await fetch(`${BASE_URL}/api/submission-status?submissionId=${encodeURIComponent(publishId)}`);
  const stBody = await stRes.json().catch(() => ({}));
  check('submission-status returns the current status', stRes.status === 200 && stBody.status === 'published' && Object.keys(stBody).length === 1, `status ${stRes.status}`);
  const stNone = await fetch(`${BASE_URL}/api/submission-status`);
  check('submission-status rejects a missing submissionId (400)', stNone.status === 400, `status ${stNone.status}`);
  const stUnknown = await fetch(`${BASE_URL}/api/submission-status?submissionId=${encodeURIComponent(`${runId}-unknown`)}`);
  check('submission-status returns 404 for an unknown submission', stUnknown.status === 404, `status ${stUnknown.status}`);

  // 4. Notify route records the notification and flags the submission
  await seed(notifyId);
  const notify = await post('/api/notify-submitter', { submissionId: notifyId, submitterEmail: 'smoke-test@example.invalid', reason: '[SMOKE TEST] revision reason' });
  const notifyBody = await notify.json().catch(() => ({}));
  check('notify-submitter returns sent', notify.status === 200 && notifyBody.sent === true, `status ${notify.status}`);
  const notes = await sb(`notifications?submission_id=eq.${encodeURIComponent(notifyId)}&select=recipient,reason`);
  check('notification row written', notes.length === 1 && notes[0].recipient === 'smoke-test@example.invalid');
  const [noteRow] = await sb(`submissions?submission_id=eq.${encodeURIComponent(notifyId)}&select=status`);
  check('submission marked revision_requested', noteRow?.status === 'revision_requested');
}

console.log(`Smoke test ${runId} against ${BASE_URL}`);
try {
  await run();
} catch (e) {
  failures++;
  console.error(`ERROR  ${e.message}`);
} finally {
  await cleanup();
}
console.log(failures ? `\n${failures} failure(s).` : '\nAll checks passed. Test rows deleted.');
process.exit(failures ? 1 : 0);

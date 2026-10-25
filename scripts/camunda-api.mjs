// Starts or resubmits an article straight through the Camunda REST API, secured with an OAuth 2.0
// client-credentials token. This is the "start by API call" path from the PoC brief, with no UI or app route in between.
//
//   npm run api -- start --title "SMOKE TEST - API start" --body-file article.txt [--email who@example.com] [--writer "Alex Rivera"] [--revision-timeout PT2M] [--submission-id <id>]
//   npm run api -- resubmit <submissionId> --title "..." --body-file revised.txt
//   npm run api -- assign <userTaskKey> --to alice      (reassign an approval task; Tasklist cannot assign to another user)
//
// Needs CAMUNDA_OAUTH_URL, CAMUNDA_CLIENT_ID, CAMUNDA_CLIENT_SECRET, CAMUNDA_ZEEBE_REST_URL (and MOCK_CMS_BASE_URL for start).
// Reads them from the environment (via .env.local). Never prints the token or any secret.
// If SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY are also set, the Supabase mirror row is kept up to date like the app does.

import { randomUUID } from 'node:crypto';
import { readFileSync } from 'node:fs';

const PROCESS_ID = 'publisherEditorialApproval';
const MESSAGE_NAME = 'publisher-approval-resubmitted';

function fail(msg) {
  console.error(msg);
  process.exit(2);
}

const [command, ...rest] = process.argv.slice(2);
if (!['start', 'resubmit', 'assign'].includes(command)) fail('usage: npm run api -- start|resubmit|assign [options]   (see the header of scripts/camunda-api.mjs)');

const positional = [];
const opts = {};
for (let i = 0; i < rest.length; i++) {
  if (rest[i].startsWith('--')) opts[rest[i].slice(2)] = rest[++i];
  else positional.push(rest[i]);
}

const required = ['CAMUNDA_OAUTH_URL', 'CAMUNDA_CLIENT_ID', 'CAMUNDA_CLIENT_SECRET', 'CAMUNDA_ZEEBE_REST_URL', ...(command === 'start' ? ['MOCK_CMS_BASE_URL'] : [])];
const missing = required.filter((name) => !process.env[name]);
if (missing.length) fail(`Missing environment variables: ${missing.join(', ')}`);

let articleBody, articleTitle, writer, wordCount, submissionId;
if (command === 'assign') {
  if (!positional[0] || !/^\d{1,20}$/.test(positional[0])) fail('A numeric user task key is required');
  if (!opts.to || !/^[A-Za-z0-9._@-]{1,100}$/.test(opts.to)) fail('--to <username> is required (letters, digits and . _ @ - only)');
} else {
  const bodyFile = opts['body-file'];
  if (!bodyFile) fail('--body-file is required');
  articleBody = readFileSync(bodyFile, 'utf8').trim();
  if (!articleBody) fail('The body file is empty');
  articleTitle = opts.title || null;
  writer = opts.writer ? String(opts.writer).trim().slice(0, 80) || null : null; // simulated journalist, business data only
  wordCount = articleBody.split(/\s+/).filter(Boolean).length;

  submissionId = command === 'start' ? opts['submission-id'] || randomUUID() : positional[0];
  if (!submissionId || !/^[A-Za-z0-9_-]{1,100}$/.test(submissionId)) fail('A valid submission id is required (letters, digits, - and _ only)');
}

const timeout = opts['revision-timeout'];
if (timeout && !/^PT(?=\d)(\d+H)?(\d+M)?(\d+S)?$/.test(timeout)) fail('--revision-timeout must be an ISO-8601 duration such as PT2M or PT1H');

async function main() {
// 1. OAuth 2.0 client-credentials token
const tokenRes = await fetch(process.env.CAMUNDA_OAUTH_URL, {
  method: 'POST',
  headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
  body: new URLSearchParams({
    grant_type: 'client_credentials',
    client_id: process.env.CAMUNDA_CLIENT_ID,
    client_secret: process.env.CAMUNDA_CLIENT_SECRET,
    audience: 'zeebe.camunda.io',
  }),
});
console.log(`1. POST token endpoint (grant_type=client_credentials) -> HTTP ${tokenRes.status}`);
if (!tokenRes.ok) process.exit(1);
const token = (await tokenRes.json()).access_token;

const camunda = (path, body) =>
  fetch(`${process.env.CAMUNDA_ZEEBE_REST_URL}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify(body),
  });

const hasSupabase = Boolean(process.env.SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY);
const sb = (path, method, body, prefer = 'return=minimal') =>
  fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`, {
    method,
    headers: {
      apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
      Authorization: `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`,
      'Content-Type': 'application/json',
      'Accept-Profile': 'demo_publisher_approval',
      'Content-Profile': 'demo_publisher_approval',
      Prefer: prefer,
    },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
  });

if (command === 'assign') {
  const res = await camunda(`/v2/user-tasks/${positional[0]}/assignment`, { assignee: opts.to, allowOverride: true });
  console.log(`2. POST /v2/user-tasks/${positional[0]}/assignment assignee=${opts.to} (Authorization: Bearer <redacted>) -> HTTP ${res.status}`);
  if (!res.ok) {
    console.error(res.status === 404 ? 'Task not found. It may already be completed.' : 'Camunda rejected the assignment.');
    process.exit(1);
  }
  console.log(`Reassigned task ${positional[0]} to ${opts.to}.`);
} else if (command === 'start') {
  const variables = {
    submissionId,
    articleTitle,
    articleBody,
    wordCount,
    submitterEmail: opts.email || 'submitter@example.com',
    submittedBy: writer,
    mockCmsBaseUrl: process.env.MOCK_CMS_BASE_URL,
    ...(timeout ? { revisionTimeout: timeout } : {}),
  };
  const res = await camunda('/v2/process-instances', { processDefinitionId: PROCESS_ID, variables });
  console.log(`2. POST /v2/process-instances (Authorization: Bearer <redacted>) -> HTTP ${res.status}`);
  if (!res.ok) {
    console.error('Camunda rejected the request.');
    process.exit(1);
  }
  const instance = await res.json();
  if (hasSupabase) {
    const m = await sb('submissions', 'POST', {
      submission_id: submissionId,
      process_instance_key: String(instance.processInstanceKey),
      article_title: articleTitle,
      article_body: articleBody,
      submitted_by: writer,
      word_count: wordCount,
      status: 'submitted',
    });
    console.log(`3. Supabase mirror row -> HTTP ${m.status}`);
  } else {
    console.log('3. Supabase not configured: the mock CMS will create the mirror row at publish time.');
  }
  console.log(`Started. processInstanceKey=${instance.processInstanceKey} submissionId=${submissionId}${timeout ? ` revisionTimeout=${timeout}` : ''}`);
} else {
    // Same rule as the app: only a submission that is waiting for a revision can be resubmitted, once per revision round.
    let round = 0;
    if (hasSupabase) {
      const id = encodeURIComponent(submissionId);
      const claim = await sb(`submissions?submission_id=eq.${id}&status=eq.revision_requested`, 'PATCH', { status: 'resubmitted', word_count: wordCount, article_title: articleTitle, article_body: articleBody, updated_at: new Date().toISOString() }, 'return=representation');
      const claimed = claim.ok ? await claim.json() : [];
      console.log(`2. Supabase claim (status must be revision_requested) -> ${claimed.length ? 'claimed' : 'refused: not waiting for a revision'}`);
      if (!claimed.length) process.exit(1);
      const notes = await sb(`notifications?submission_id=eq.${id}&select=id`, 'GET', undefined, 'return=representation');
      round = notes.ok ? (await notes.json()).length : 0;
    }
    const res = await camunda('/v2/messages/publication', {
      name: MESSAGE_NAME,
      correlationKey: submissionId,
      ...(hasSupabase ? { messageId: `${submissionId}:r${round}` } : {}),
      variables: { submissionId, articleTitle, articleBody, wordCount },
      timeToLive: 5 * 60 * 1000, // milliseconds: the API takes an integer
    });
    console.log(`3. POST /v2/messages/publication name=${MESSAGE_NAME} (Authorization: Bearer <redacted>) -> HTTP ${res.status}`);
    if (!res.ok) {
      if (hasSupabase && res.status !== 409) await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}&status=eq.resubmitted`, 'PATCH', { status: 'revision_requested' });
      console.error(res.status === 409 ? 'Camunda says this revision round was already resubmitted.' : 'Camunda rejected the message.');
      process.exit(1);
    }
    console.log(`Resubmitted into the waiting instance. submissionId=${submissionId}`);
  }
}

main().catch((e) => {
  console.error(`Request failed: ${e.cause?.code || e.message}`);
  process.exit(1);
});

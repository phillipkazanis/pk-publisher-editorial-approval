// Minimal local stand-in for the few Camunda endpoints the Editor tasks page uses, so the page can be tried without a cluster.
// It is NOT Camunda: it only answers these calls, and rejects requests that do not match the documented shapes.
//
//   POST /oauth/token                                           (client credentials)
//   POST /v2/user-tasks/search
//   POST /v2/user-tasks/{key}/effective-variables/search
//   POST /v2/user-tasks/{key}/completion
//   POST /v2/process-instances                                  (used by scripts/camunda-api.mjs)
//   POST /v2/messages/publication                               (used by scripts/camunda-api.mjs)
//   GET  /_state                                                (test helper: what was completed and with which variables)
//
// Run: npm run fake:camunda, then start the app with the overrides shown in the README.

import { createServer } from 'node:http';

const PORT = Number(process.env.FAKE_CAMUNDA_PORT || 4010);
const TOKEN = 'fake-token';

const CLEAN_TEXT = `The city council voted on Tuesday to approve a new cycling network. The plan includes separated bike lanes, better lighting and secure parking at six train stations.\n\nThe first stage begins in March. A public information session will be held next month.`;

const tasks = new Map([
  ['2251799813685301', { assignee: null, creationDate: '2026-10-25T05:10:00.000Z', processInstanceKey: '2251799813685201', vars: { submissionId: 'fake-submission-1', submittedBy: 'Alex Rivera', articleTitle: '[FAKE] Cycling network approved', articleBody: CLEAN_TEXT, wordCount: 45, submitterEmail: 'journalist@example.invalid', complianceResult: { verdict: 'PASS', reason: 'Passed deterministic rules' }, aiComplianceResult: { responseJson: { verdict: 'PASS', reasons: [], warnings: ['HL-2: the headline is a question; the article only partly answers it.'], suggestedFixes: [], rulesChecked: ['HL-1', 'HL-2', 'AT-1', 'TN-1'] }, context: { note: 'conversation history omitted in the fake' } } } }],
  ['2251799813685302', { assignee: 'editor1', creationDate: '2026-10-25T05:20:00.000Z', processInstanceKey: '2251799813685202', vars: { submissionId: 'fake-submission-2', submittedBy: 'Sam Okafor', articleTitle: '[FAKE] Storm warning issued', articleBody: 'The weather bureau has issued a severe storm warning for the region.', wordCount: 12, submitterEmail: 'journalist@example.invalid', complianceResult: { verdict: 'PASS', reason: 'Passed deterministic rules' }, aiComplianceResult: { responseJson: { verdict: 'PASS', reasons: [], warnings: [], suggestedFixes: [], rulesChecked: ['TN-1'] } } } }],
]);
const completed = [];
const started = [];
const messages = [];

function send(res, status, body) {
  if (status === 204) return res.writeHead(204).end();
  res.writeHead(status, { 'Content-Type': body && body.type ? 'application/problem+json' : 'application/json' }).end(JSON.stringify(body));
}
const problem = (res, status, detail) => send(res, status, { type: 'about:blank', title: 'Error', status, detail });

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => (data += c));
    req.on('end', () => resolve(data));
  });
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const raw = await readBody(req);
  console.log(`${req.method} ${url.pathname}${url.search}`);

  if (req.method === 'GET' && url.pathname === '/_state') return send(res, 200, { open: [...tasks.keys()], completed, started, messages });

  if (req.method === 'POST' && url.pathname === '/oauth/token') {
    const form = new URLSearchParams(raw);
    if (form.get('grant_type') !== 'client_credentials' || !form.get('client_id') || !form.get('client_secret')) return problem(res, 400, 'bad token request');
    return send(res, 200, { access_token: TOKEN, expires_in: 3600, token_type: 'Bearer' });
  }

  if (!url.pathname.startsWith('/v2/')) return problem(res, 404, 'not found');
  if (req.headers.authorization !== `Bearer ${TOKEN}`) return problem(res, 401, 'missing or invalid token');

  let body = {};
  try {
    body = raw ? JSON.parse(raw) : {};
  } catch {
    return problem(res, 400, 'invalid JSON');
  }

  if (req.method === 'POST' && url.pathname === '/v2/process-instances') {
    const v = body.variables || {};
    if (body.processDefinitionId !== 'publisherEditorialApproval' || !v.submissionId || !v.articleBody || !v.mockCmsBaseUrl) return problem(res, 400, 'unexpected process start request');
    const processInstanceKey = String(2251799813690000 + started.length);
    started.push({ processInstanceKey, variableNames: Object.keys(v), revisionTimeout: v.revisionTimeout ?? null, submissionId: v.submissionId, submittedBy: v.submittedBy ?? null, submitterEmail: v.submitterEmail ?? null });
    return send(res, 200, { processInstanceKey, processDefinitionKey: '2251799813680001', processDefinitionId: body.processDefinitionId });
  }

  if (req.method === 'POST' && url.pathname === '/v2/messages/publication') {
    if (body.name !== 'publisher-approval-resubmitted' || !body.correlationKey || !body.variables?.articleBody) return problem(res, 400, 'unexpected message publication');
    // The real API takes timeToLive as an integer number of milliseconds, not an ISO duration.
    if (body.timeToLive !== undefined && !Number.isInteger(body.timeToLive)) return problem(res, 400, 'timeToLive must be an integer (milliseconds)');
    // A repeated messageId is rejected while the message is buffered.
    if (body.messageId && messages.some((m) => m.messageId === body.messageId)) return problem(res, 409, 'a message with this messageId was already published');
    messages.push({ name: body.name, correlationKey: body.correlationKey, messageId: body.messageId ?? null, timeToLive: body.timeToLive });
    return send(res, 200, { messageKey: String(2251799813699000 + messages.length) });
  }

  if (req.method === 'POST' && url.pathname === '/v2/user-tasks/search') {
    const f = body.filter || {};
    if (f.state !== 'CREATED' || f.candidateGroup !== 'editors' || f.elementId !== 'Task_EditorialApproval') return problem(res, 400, 'unexpected filter');
    const items = [...tasks.entries()].map(([userTaskKey, t]) => ({
      userTaskKey, name: 'Editorial approval', state: 'CREATED', assignee: t.assignee, elementId: 'Task_EditorialApproval',
      candidateGroups: ['editors'], candidateUsers: [], processDefinitionId: 'publisherEditorialApproval', creationDate: t.creationDate,
      processInstanceKey: t.processInstanceKey, tenantId: '<default>',
    }));
    return send(res, 200, { items, page: { totalItems: items.length } });
  }

  const m = url.pathname.match(/^\/v2\/user-tasks\/(\d+)\/(effective-variables\/search|completion)$/);
  if (req.method === 'POST' && m) {
    const [, key, action] = m;
    const task = tasks.get(key);
    if (!task) return problem(res, 404, 'user task not found');
    if (action === 'effective-variables/search') {
      if (url.searchParams.get('truncateValues') !== 'false') return problem(res, 400, 'expected truncateValues=false');
      const items = Object.entries(task.vars).map(([name, value]) => ({ name, value: JSON.stringify(value), isTruncated: false, processInstanceKey: task.processInstanceKey }));
      return send(res, 200, { items, page: { totalItems: items.length } });
    }
    const v = body.variables || {};
    if (!['APPROVE', 'REJECT'].includes(v.approvalDecision)) return problem(res, 400, 'approvalDecision must be APPROVE or REJECT');
    tasks.delete(key);
    completed.push({ key, variables: v });
    return send(res, 204);
  }

  return problem(res, 404, 'not found');
});

server.listen(PORT, () => console.log(`Fake Camunda listening on http://localhost:${PORT} (2 seeded approval tasks). Not a real engine.`));

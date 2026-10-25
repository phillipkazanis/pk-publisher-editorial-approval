import { camundaRequest, missingCamundaEnv } from '../../../lib/camunda-auth';
import { articleStats } from '../../../lib/article-stats';
import { MANAGER, isValidAssignee } from '../../../lib/editors';

const EDITOR_GROUP = 'editors';
const APPROVAL_ELEMENT_ID = 'Task_EditorialApproval';
const WANTED = ['submissionId', 'submittedBy', 'articleTitle', 'articleBody', 'wordCount', 'submitterEmail', 'revisionRound', 'complianceResult', 'aiComplianceResult'];

// Variable values come back as JSON-encoded strings.
function parseValue(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

async function variablesFor(taskKey) {
  const result = await camundaRequest(`/v2/user-tasks/${taskKey}/effective-variables/search?truncateValues=false`, { page: { limit: 100 } });
  const vars = {};
  for (const v of result.items || []) if (WANTED.includes(v.name)) vars[v.name] = parseValue(v.value);
  return vars;
}

// Lists open editorial approval tasks for the editors group, with the article and check results.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  // ?viewer=<username> returns only the tasks assigned to that editor; no viewer (or the manager) returns every open task.
  const viewer = typeof req.query.viewer === 'string' ? req.query.viewer : MANAGER;
  if (viewer !== MANAGER && !isValidAssignee(viewer)) return res.status(400).json({ error: 'viewer must be a username' });
  const missing = missingCamundaEnv();
  if (missing.length) return res.status(503).json({ error: 'Camunda is not configured for this app.', missing });

  try {
    const found = await camundaRequest('/v2/user-tasks/search', {
      filter: { state: 'CREATED', candidateGroup: EDITOR_GROUP, elementId: APPROVAL_ELEMENT_ID, ...(viewer !== MANAGER ? { assignee: viewer } : {}) },
      page: { limit: 50 },
    });
    const tasks = await Promise.all(
      (found.items || []).map(async (t) => {
        let vars = {};
        let variablesError = false;
        try {
          vars = await variablesFor(t.userTaskKey);
        } catch {
          variablesError = true;
        }
        const ai = vars.aiComplianceResult || {};
        const aiJson = ai.responseJson && typeof ai.responseJson === 'object' ? ai.responseJson : null;
        const strings = (v) => (Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
        return {
          taskKey: String(t.userTaskKey),
          processInstanceKey: String(t.processInstanceKey),
          assignee: t.assignee || null,
          created: t.creationDate,
          submissionId: vars.submissionId || null,
          submittedBy: vars.submittedBy || null,
          articleTitle: vars.articleTitle || null,
          articleBody: vars.articleBody || null,
          wordCount: vars.wordCount ?? null,
          rulesVerdict: vars.complianceResult?.verdict || null,
          rulesReason: vars.complianceResult?.reason || null,
          // The compliance agent returns structured JSON; older instances returned plain text.
          aiVerdict: aiJson?.verdict || (typeof ai.responseText === 'string' ? ai.responseText.split('\n')[0].trim() : null),
          aiReasons: strings(aiJson?.reasons),
          aiWarnings: strings(aiJson?.warnings),
          aiSuggestedFixes: strings(aiJson?.suggestedFixes),
          aiSummary: typeof aiJson?.summary === 'string' ? aiJson.summary : null,
          claimsNeedingSources: strings(aiJson?.claimsNeedingSources),
          revisionRound: (Number.isInteger(vars.revisionRound) ? vars.revisionRound : 0) + 1,
          stats: articleStats(vars.articleTitle, vars.articleBody),
          aiRulesChecked: strings(aiJson?.rulesChecked),
          variablesError,
        };
      })
    );
    tasks.sort((a, b) => String(a.created).localeCompare(String(b.created)));
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ tasks });
  } catch (e) {
    const hint = e.status === 401 || e.status === 403 ? ' The API client may not be authorised to read user tasks.' : '';
    return res.status(502).json({ error: `Could not read tasks from Camunda (${e.status || 'network error'}).${hint}` });
  }
}

import { camundaRequest, missingCamundaEnv } from '../../../../lib/camunda-auth';
import { isValidAssignee } from '../../../../lib/editors';

// Reassigns one approval task to another editor. Tasklist lets a user claim a task but not assign it to someone else,
// so this is how a manager delegates. allowOverride lets it take a task another editor has already claimed.
// The assignment is made by the API client: the engine history records the client as the actor, and the assignee is
// then recorded when they complete the task in Tasklist.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { key } = req.query;
  if (typeof key !== 'string' || !/^\d{1,20}$/.test(key)) return res.status(400).json({ error: 'Invalid task key' });

  const { assignee } = req.body || {};
  if (!isValidAssignee(assignee)) return res.status(400).json({ error: 'assignee must be a username (letters, digits and . _ @ - only)' });

  const missing = missingCamundaEnv();
  if (missing.length) return res.status(503).json({ error: 'Camunda is not configured for this app.', missing });

  try {
    await camundaRequest(`/v2/user-tasks/${key}/assignment`, { assignee, allowOverride: true });
    return res.status(200).json({ assigned: true, assignee });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: 'Task not found. It may already be completed.' });
    if (e.status === 409) return res.status(409).json({ error: 'Task is no longer open. It may already be completed.' });
    const hint = e.status === 401 || e.status === 403 ? ' The API client may not be authorised to update user tasks.' : '';
    return res.status(502).json({ error: `Could not reassign the task in Camunda (${e.status || 'network error'}).${hint}` });
  }
}

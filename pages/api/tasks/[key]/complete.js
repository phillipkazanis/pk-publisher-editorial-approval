import { camundaRequest, missingCamundaEnv } from '../../../../lib/camunda-auth';

// Completes one editorial approval task. Variable names match the approval form (approvalDecision, revisionReason).
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { key } = req.query;
  if (typeof key !== 'string' || !/^\d{1,20}$/.test(key)) return res.status(400).json({ error: 'Invalid task key' });

  const { decision, reason } = req.body || {};
  if (decision !== 'APPROVE' && decision !== 'REJECT') return res.status(400).json({ error: 'decision must be APPROVE or REJECT' });
  const trimmed = typeof reason === 'string' ? reason.trim().slice(0, 1000) : '';
  if (decision === 'REJECT' && !trimmed) return res.status(400).json({ error: 'A reason is required when rejecting' });

  const missing = missingCamundaEnv();
  if (missing.length) return res.status(503).json({ error: 'Camunda is not configured for this app.', missing });

  try {
    await camundaRequest(`/v2/user-tasks/${key}/completion`, {
      variables: { approvalDecision: decision, revisionReason: decision === 'REJECT' ? trimmed : null },
    });
    return res.status(200).json({ completed: true });
  } catch (e) {
    if (e.status === 404) return res.status(404).json({ error: 'Task not found. It may already be completed.' });
    if (e.status === 409) return res.status(409).json({ error: 'Task is no longer open. It may already be completed.' });
    const hint = e.status === 401 || e.status === 403 ? ' The API client may not be authorised to complete user tasks.' : '';
    return res.status(502).json({ error: `Could not complete the task in Camunda (${e.status || 'network error'}).${hint}` });
  }
}

import { sb } from '../../lib/supabase';

// Notification stub: logs the revision request. Replace with the Camunda email connector for production.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { submissionId, submitterEmail, reason } = req.body || {};
  try {
    await sb('notifications', {
      method: 'POST',
      body: JSON.stringify({ submission_id: submissionId, recipient: submitterEmail, reason }),
    });
    await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'revision_requested', last_notification: reason, updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ sent: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

import { sb } from '../../lib/supabase';

// Called by the process when the revision timer fires and the instance ends as Abandoned.
// Marks the Supabase mirror so the app stops accepting resubmissions for it. Safe to repeat.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { submissionId } = req.body || {};
  if (typeof submissionId !== 'string' || !submissionId || submissionId.length > 100) {
    return res.status(400).json({ error: 'submissionId required' });
  }
  try {
    const rows = await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}&status=eq.revision_requested`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'abandoned', updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ abandoned: rows.length > 0 });
  } catch {
    return res.status(500).json({ error: 'Could not mark the submission as abandoned' });
  }
}

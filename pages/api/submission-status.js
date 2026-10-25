import { sb } from '../../lib/supabase';

// Read-only: returns the status (and latest revision reason) of one submission, for the status tracker on the form page.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { submissionId } = req.query;
  if (typeof submissionId !== 'string' || !submissionId || submissionId.length > 100) {
    return res.status(400).json({ error: 'submissionId required' });
  }
  try {
    const rows = await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}&select=status,last_notification`);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.setHeader('Cache-Control', 'no-store');
    // reason = the latest revision request sent to the submitter (only meaningful while status is revision_requested)
    return res.status(200).json({ status: rows[0].status, reason: rows[0].last_notification || null });
  } catch {
    return res.status(500).json({ error: 'status lookup failed' });
  }
}

import { sb } from '../../lib/supabase';

// Read-only: returns just the status of one submission, for the status strip on the form page.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  const { submissionId } = req.query;
  if (typeof submissionId !== 'string' || !submissionId || submissionId.length > 100) {
    return res.status(400).json({ error: 'submissionId required' });
  }
  try {
    const rows = await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}&select=status`);
    if (!rows.length) return res.status(404).json({ error: 'not found' });
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ status: rows[0].status });
  } catch {
    return res.status(500).json({ error: 'status lookup failed' });
  }
}

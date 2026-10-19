import { randomUUID } from 'crypto';
import { sb } from '../../../lib/supabase';

// Mock CMS: fails the first attempt per submission (HTTP 500) so the BPMN retry/backoff is visible.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { submissionId } = req.body || {};
  if (!submissionId) return res.status(400).json({ error: 'submissionId required' });

  try {
    const rows = await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}&select=publish_attempts`);
    const attempts = (rows[0]?.publish_attempts || 0) + 1;
    await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ publish_attempts: attempts, updated_at: new Date().toISOString() }),
    });
    if (attempts === 1) {
      return res.status(500).json({ error: 'CMS temporarily unavailable (simulated)' });
    }
    const cmsId = randomUUID();
    await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'published', updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ published: true, cmsId, attempts });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

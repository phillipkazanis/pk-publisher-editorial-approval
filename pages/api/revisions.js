import { sb } from '../../lib/supabase';

// Read-only: submissions that are waiting for a revised version, with the reason and the last text,
// so the submitter can reopen one and resubmit into the same process instance.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const rows = await sb(
      'submissions?status=eq.revision_requested&select=submission_id,article_title,article_body,last_notification,updated_at&order=updated_at.desc&limit=20'
    );
    const notes = await sb('notifications?select=submission_id&limit=1000');
    const counts = {};
    for (const n of notes) counts[n.submission_id] = (counts[n.submission_id] || 0) + 1;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      revisions: rows.map((r) => ({
        submissionId: r.submission_id,
        title: r.article_title,
        body: r.article_body,
        reason: r.last_notification,
        round: counts[r.submission_id] || 1,
        updatedAt: r.updated_at,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not load revisions' });
  }
}

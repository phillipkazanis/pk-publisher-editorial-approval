import { sb } from '../../../lib/supabase';

// Read-only: recent submissions with publish attempts and notification counts, from the Supabase audit mirror.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const rows = await sb(
      'submissions?select=submission_id,article_title,word_count,status,publish_attempts,last_notification,process_instance_key,submitted_by,created_at,updated_at&order=updated_at.desc&limit=50'
    );
    const notes = await sb('notifications?select=submission_id&limit=1000');
    const counts = {};
    for (const n of notes) counts[n.submission_id] = (counts[n.submission_id] || 0) + 1;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      submissions: rows.map((r) => ({
        submissionId: r.submission_id,
        title: r.article_title,
        submittedBy: r.submitted_by,
        wordCount: r.word_count,
        status: r.status,
        publishAttempts: r.publish_attempts,
        lastNotification: r.last_notification,
        processInstanceKey: r.process_instance_key,
        notifications: counts[r.submission_id] || 0,
        createdAt: r.created_at,
        updatedAt: r.updated_at,
      })),
    });
  } catch {
    return res.status(500).json({ error: 'Could not load submissions' });
  }
}

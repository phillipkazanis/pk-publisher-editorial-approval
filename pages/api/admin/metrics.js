import { sb } from '../../../lib/supabase';
import { computeMetrics } from '../../../lib/metrics';

// Read-only: headline business metrics across all submissions (first-pass rate, revision rounds, time to publish, retries, abandonment).
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const submissions = await sb('submissions?select=submission_id,status,created_at,updated_at,publish_attempts&limit=1000');
    const notifications = await sb('notifications?select=submission_id&limit=5000');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json(computeMetrics(submissions, notifications));
  } catch {
    return res.status(500).json({ error: 'Could not calculate metrics' });
  }
}

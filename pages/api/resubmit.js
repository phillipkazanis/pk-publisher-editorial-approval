import { camundaPost, missingCamundaEnv } from '../../lib/camunda-auth';
import { sb, wordCountOf } from '../../lib/supabase';

const MESSAGE_NAME = 'publisher-approval-resubmitted';
// Milliseconds (the API takes an integer). The message is buffered briefly so a resubmit that lands just before
// the process reaches its wait state still correlates.
const MESSAGE_TTL_MS = 5 * 60 * 1000;

const WHY_NOT = {
  published: 'This article has already been published.',
  abandoned: 'This submission was abandoned because no revision arrived in time. Start a new submission.',
  submitted: 'This submission is still being checked. Wait until a revision is requested.',
  resubmitted: 'This submission has already been resubmitted and is being checked.',
};

// Resubmits revised content into the SAME process instance. It is only allowed while the submission is waiting for a
// revision, and only once per revision round, so a double click or a late resubmit cannot start a second loop.
export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { submissionId, articleTitle, articleBody } = req.body || {};
  if (typeof submissionId !== 'string' || !submissionId || submissionId.length > 100 || !articleBody) {
    return res.status(400).json({ error: 'submissionId and articleBody required' });
  }
  const id = encodeURIComponent(submissionId);
  const wordCount = wordCountOf(articleBody);
  try {
    // Refuse early (and without touching anything) unless the submission is waiting for a revision.
    const current = await sb(`submissions?submission_id=eq.${id}&select=status`);
    if (!current.length) return res.status(404).json({ error: 'Submission not found.' });
    if (current[0].status !== 'revision_requested') {
      return res.status(409).json({ error: WHY_NOT[current[0].status] || 'This submission is not waiting for a revision.', status: current[0].status });
    }
    const missing = missingCamundaEnv();
    if (missing.length) return res.status(503).json({ error: 'Camunda is not configured for this app.', missing });

    // 1. Claim the resubmission atomically, so two requests cannot both go through.
    const claimed = await sb(`submissions?submission_id=eq.${id}&status=eq.revision_requested`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resubmitted', word_count: wordCount, article_title: articleTitle || null, article_body: articleBody, updated_at: new Date().toISOString() }),
    });
    if (!claimed.length) return res.status(409).json({ error: WHY_NOT.resubmitted, status: 'resubmitted' });

    // 2. Publish once per revision round. messageId makes the engine reject a repeat for the same round.
    const round = (await sb(`notifications?submission_id=eq.${id}&select=id`)).length;
    try {
      await camundaPost('/v2/messages/publication', {
        name: MESSAGE_NAME,
        correlationKey: submissionId,
        messageId: `${submissionId}:r${round}`,
        variables: { submissionId, articleTitle: articleTitle || null, articleBody, wordCount },
        timeToLive: MESSAGE_TTL_MS,
      });
    } catch (e) {
      if (e.status === 409) return res.status(409).json({ error: 'This revision has already been resubmitted.' });
      // Put the claim back so the submitter can try again.
      await sb(`submissions?submission_id=eq.${id}&status=eq.resubmitted`, { method: 'PATCH', body: JSON.stringify({ status: 'revision_requested' }) }).catch(() => {});
      return res.status(502).json({ error: `Could not send the revision to Camunda (${e.status || 'network error'}). Try again.` });
    }
    return res.status(200).json({ resubmitted: true, round });
  } catch {
    return res.status(500).json({ error: 'Could not resubmit. Try again.' });
  }
}

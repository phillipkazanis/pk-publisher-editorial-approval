import { camundaPost } from '../../lib/camunda-auth';
import { sb, wordCountOf } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { submissionId, articleTitle, articleBody } = req.body || {};
  if (!submissionId || !articleBody) return res.status(400).json({ error: 'submissionId and articleBody required' });

  const wordCount = wordCountOf(articleBody);
  try {
    // Native message publish: correlates to the waiting event-based gateway in the same instance
    await camundaPost('/v2/messages/publication', {
      name: 'publisher-approval-resubmitted',
      correlationKey: submissionId,
      variables: { submissionId, articleTitle: articleTitle || null, articleBody, wordCount },
      timeToLive: 'PT1H',
    });
    await sb(`submissions?submission_id=eq.${encodeURIComponent(submissionId)}`, {
      method: 'PATCH',
      body: JSON.stringify({ status: 'resubmitted', word_count: wordCount, article_title: articleTitle || null, updated_at: new Date().toISOString() }),
    });
    return res.status(200).json({ resubmitted: true });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

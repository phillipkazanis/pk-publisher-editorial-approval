import { randomUUID } from 'crypto';
import { camundaPost } from '../../lib/camunda-auth';
import { sb, wordCountOf } from '../../lib/supabase';

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).end();
  const { articleTitle, articleBody, submitterEmail, submittedBy } = req.body || {};
  if (!articleBody) return res.status(400).json({ error: 'articleBody required' });
  // The writer is business data (a simulated journalist), not a login. Keep it short and plain.
  const writer = typeof submittedBy === 'string' && submittedBy.trim() ? submittedBy.trim().slice(0, 80) : null;

  const submissionId = randomUUID();
  const wordCount = wordCountOf(articleBody);
  try {
    const instance = await camundaPost('/v2/process-instances', {
      processDefinitionId: 'publisherEditorialApproval',
      variables: {
        submissionId,
        articleTitle: articleTitle || null,
        articleBody,
        wordCount,
        submitterEmail: submitterEmail || 'submitter@example.com',
        submittedBy: writer,
        mockCmsBaseUrl: process.env.MOCK_CMS_BASE_URL,
      },
    });
    await sb('submissions', {
      method: 'POST',
      body: JSON.stringify({
        submission_id: submissionId,
        process_instance_key: String(instance.processInstanceKey),
        article_title: articleTitle || null,
        article_body: articleBody,
        submitted_by: writer,
        word_count: wordCount,
        status: 'submitted',
      }),
    });
    return res.status(200).json({ submissionId, processInstanceKey: instance.processInstanceKey });
  } catch (e) {
    return res.status(500).json({ error: e.message });
  }
}

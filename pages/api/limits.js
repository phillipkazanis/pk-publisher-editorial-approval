import { sb } from '../../lib/supabase';

// Read-only: the word-count limits the compliance rules enforce, so the forms can show them while someone is writing.
export default async function handler(req, res) {
  if (req.method !== 'GET') return res.status(405).end();
  try {
    const rows = await sb('compliance_thresholds?select=rule_key,threshold_value');
    const value = (key) => rows.find((r) => r.rule_key === key)?.threshold_value ?? null;
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ maxWordCount: value('max_word_count'), minWordCount: value('min_word_count') });
  } catch {
    return res.status(500).json({ error: 'Could not load the limits' });
  }
}

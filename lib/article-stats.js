// Plain statistics about an article, for the editor. Calculated from the text, so nothing here is a judgement:
// it is information to read alongside the rules check and the AI review.
const ATTRIBUTION = /\b(said|says|told|according to|spokesperson|stated|announced|confirmed|reported|reportedly|alleged|allegedly|accused)\b/gi;
const QUOTE = /“[^”]+”|"[^"\n]+"/g;
const FIGURE = /\b\d[\d,.]*%?/g;
const WORDS_PER_MINUTE = 200;

const wordsIn = (s) => s.split(/\s+/).filter(Boolean).length;

export function articleStats(title, body) {
  const text = typeof body === 'string' ? body.trim() : '';
  const headline = typeof title === 'string' ? title.trim() : '';
  const sentences = text ? text.split(/(?<=[.!?])["”')\]]*\s+/).map((s) => s.trim()).filter(Boolean) : [];
  const lengths = sentences.map(wordsIn);
  const words = text ? wordsIn(text) : 0;
  return {
    words,
    paragraphs: text ? text.split(/\n\s*\n/).filter((p) => p.trim()).length : 0,
    sentences: sentences.length,
    avgSentenceWords: lengths.length ? Math.round((words / lengths.length) * 10) / 10 : 0,
    longestSentenceWords: lengths.length ? Math.max(...lengths) : 0,
    readMinutes: words ? Math.max(1, Math.ceil(words / WORDS_PER_MINUTE)) : 0,
    quotes: (text.match(QUOTE) || []).length,
    attributions: (text.match(ATTRIBUTION) || []).length,
    figures: (text.match(FIGURE) || []).length,
    headlineWords: headline ? wordsIn(headline) : 0,
    headlineChars: headline.length,
  };
}

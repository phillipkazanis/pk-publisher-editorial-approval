import styles from '../../styles/App.module.css';

const fmt = (n) => Number(n).toLocaleString('en-AU');

function Stat({ label, value, warn }) {
  return (
    <div className={styles.stat}>
      <dt>{label}</dt>
      <dd className={warn ? styles.checkFail : ''}>{value}</dd>
    </div>
  );
}

// Plain facts about the text, calculated from the article. Information for the editor, not a judgement.
export default function ArticleStats({ stats, limits }) {
  const over = limits?.maxWordCount && stats.words > limits.maxWordCount;
  const under = limits?.minWordCount && stats.words < limits.minWordCount;
  const limitNote = over ? ` (${fmt(stats.words - limits.maxWordCount)} over the ${fmt(limits.maxWordCount)} maximum)` : under ? ` (${fmt(limits.minWordCount - stats.words)} under the ${fmt(limits.minWordCount)} minimum)` : '';
  return (
    <dl className={styles.stats} aria-label="Article statistics">
      <Stat label="Words" value={`${fmt(stats.words)}${limitNote}`} warn={over || under} />
      <Stat label="Read time" value={`${stats.readMinutes} min`} />
      <Stat label="Paragraphs" value={fmt(stats.paragraphs)} />
      <Stat label="Sentences" value={`${fmt(stats.sentences)} (avg ${stats.avgSentenceWords} words, longest ${stats.longestSentenceWords})`} />
      <Stat label="Quotations" value={fmt(stats.quotes)} />
      <Stat label="Attribution phrases" value={fmt(stats.attributions)} />
      <Stat label="Figures" value={fmt(stats.figures)} />
      <Stat label="Headline" value={`${stats.headlineWords} words, ${stats.headlineChars} characters`} />
    </dl>
  );
}

import { useEffect, useState } from 'react';
import styles from '../styles/App.module.css';

// Same counting rule as the server (lib/supabase.js wordCountOf).
export const countWords = (text) => (text || '').trim().split(/\s+/).filter(Boolean).length;

// The limits come from the same table the compliance rules read, so the form and the rules cannot disagree.
export function useLimits() {
  const [limits, setLimits] = useState(null);
  useEffect(() => {
    let cancelled = false;
    fetch('/api/limits')
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !cancelled && setLimits(j))
      .catch(() => {});
    return () => {
      cancelled = true;
    };
  }, []);
  return limits;
}

const fmt = (n) => n.toLocaleString('en-AU');

export default function WordCount({ text, limits }) {
  const n = countWords(text);
  const max = limits?.maxWordCount;
  const min = limits?.minWordCount;
  const over = max && n > max;
  const under = min && n > 0 && n < min;
  return (
    <p className={`${styles.wordCount} ${over || under ? styles.wordCountWarn : ''}`} aria-live="polite">
      {fmt(n)} words
      {max ? ` · maximum ${fmt(max)}` : ''}
      {min ? ` · minimum ${fmt(min)}` : ''}
      {over ? ` · ${fmt(n - max)} over` : ''}
      {under ? ` · ${fmt(min - n)} short` : ''}
    </p>
  );
}

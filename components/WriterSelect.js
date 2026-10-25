import { useEffect, useState } from 'react';
import { WRITERS, writerLabel } from '../lib/writers';
import styles from '../styles/App.module.css';

const KEY = 'demoWriterId';

// The simulated writer who is "signed in", remembered in this browser only. '' means all writers.
export function useWriterId(defaultId) {
  const [id, setId] = useState(defaultId);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved !== null && (saved === '' || WRITERS.some((w) => w.id === saved))) setId(saved);
    } catch {
      // Storage can be blocked; the default is fine.
    }
  }, []);
  const update = (next) => {
    setId(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Ignore.
    }
  };
  return [id, update];
}

export default function WriterSelect({ id, label, value, onChange, includeAll }) {
  return (
    <>
      <label className={styles.label} htmlFor={id}>{label}</label>
      <select id={id} className={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {includeAll && <option value="">All writers</option>}
        {WRITERS.map((w) => (
          <option key={w.id} value={w.id}>{writerLabel(w)}</option>
        ))}
      </select>
    </>
  );
}

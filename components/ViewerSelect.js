import { useEffect, useState } from 'react';
import { MANAGER, viewerOptions } from '../lib/editors';
import styles from '../styles/App.module.css';

const KEY = 'demoViewer';

// Who is "signed in" on the Editor tasks page, remembered in this browser only.
export function useViewer() {
  const [viewer, setViewer] = useState(MANAGER);
  useEffect(() => {
    try {
      const saved = window.localStorage.getItem(KEY);
      if (saved && viewerOptions().includes(saved)) setViewer(saved);
    } catch {
      // Storage can be blocked; the default is fine.
    }
  }, []);
  const update = (next) => {
    setViewer(next);
    try {
      window.localStorage.setItem(KEY, next);
    } catch {
      // Ignore.
    }
  };
  return [viewer, update];
}

export default function ViewerSelect({ value, onChange }) {
  return (
    <div className={styles.writerFilter}>
      <label className={styles.label} htmlFor="viewer">Viewing as</label>
      <select id="viewer" className={styles.input} value={value} onChange={(e) => onChange(e.target.value)}>
        {viewerOptions().map((v) => (
          <option key={v} value={v}>{v === MANAGER ? 'manager (all tasks, assigns work)' : v}</option>
        ))}
      </select>
    </div>
  );
}

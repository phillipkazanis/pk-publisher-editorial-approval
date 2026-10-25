import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import styles from '../styles/App.module.css';

const REFRESH_MS = 5000;

const STATUS_LABELS = {
  submitted: 'Submitted',
  revision_requested: 'Revision requested',
  resubmitted: 'Resubmitted',
  published: 'Published',
};

function when(iso) {
  return iso ? new Date(iso).toLocaleString('en-AU') : '';
}

export default function Admin() {
  const [rows, setRows] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/admin/submissions');
      const j = await r.json();
      if (!r.ok) return setError(j.error || 'Could not load submissions.');
      setError('');
      setRows(j.submissions);
    } catch {
      setError('Could not reach the app.');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  const counts = {};
  for (const r of rows || []) counts[r.status] = (counts[r.status] || 0) + 1;

  return (
    <Layout title="Admin">
      <h1 className={styles.title}>Admin</h1>
      <p className={styles.intro}>
        Recent submissions and their status. For the step-by-step history, variables and AI input and output of an instance, open it in Camunda Operate.
      </p>

      {error && (
        <p className={styles.notice} role="alert">
          {error}
        </p>
      )}

      {rows && (
        <div className={styles.summary}>
          <span className={styles.chip}>{rows.length} submissions</span>
          {Object.entries(counts).map(([status, n]) => (
            <span key={status} className={styles.chip}>
              {STATUS_LABELS[status] || status}: {n}
            </span>
          ))}
        </div>
      )}

      <section className={styles.card}>
        {rows === null && !error && <p className={styles.empty}>Loading...</p>}
        {rows && !rows.length && <p className={styles.empty}>No submissions yet.</p>}
        {rows && rows.length > 0 && (
          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Headline</th>
                  <th>Status</th>
                  <th>Publish attempts</th>
                  <th>Notifications</th>
                  <th>Instance key</th>
                  <th>Updated</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.submissionId}>
                    <td className={styles.cellTitle}>
                      {r.title || '(no headline)'}
                      <div className={styles.mono}>{r.submissionId}</div>
                      {r.status === 'revision_requested' && r.lastNotification && (
                        <div className={styles.taskMeta}>Revision reason: {r.lastNotification}</div>
                      )}
                    </td>
                    <td data-label="Status">
                      <span className={`${styles.badge} ${styles[`badge_${r.status}`] || ''}`}>{STATUS_LABELS[r.status] || r.status}</span>
                    </td>
                    <td data-label="Publish attempts">{r.publishAttempts}</td>
                    <td data-label="Notifications">{r.notifications}</td>
                    <td data-label="Instance key" className={styles.nowrap}>
                      <span className={styles.mono}>{r.processInstanceKey || '-'}</span>
                    </td>
                    <td data-label="Updated">{when(r.updatedAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </Layout>
  );
}

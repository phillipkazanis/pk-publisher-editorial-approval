import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { reasonPreview } from '../lib/reason';
import styles from '../styles/App.module.css';

const REFRESH_MS = 5000;

const STATUS_LABELS = {
  submitted: 'Submitted',
  revision_requested: 'Revision requested',
  resubmitted: 'Resubmitted',
  published: 'Published',
  abandoned: 'Abandoned',
};

const pctText = (n) => (n == null ? '-' : `${n}%`);
function durationText(minutes) {
  if (minutes == null) return '-';
  return minutes >= 120 ? `${Math.round(minutes / 6) / 10} h` : `${minutes} min`;
}

function Kpi({ label, value, hint }) {
  return (
    <div className={styles.kpi}>
      <span className={styles.kpiLabel}>{label}</span>
      <span className={styles.kpiValue}>{value}</span>
      <span className={styles.kpiHint}>{hint}</span>
    </div>
  );
}

function when(iso) {
  return iso ? new Date(iso).toLocaleString('en-AU') : '';
}

export default function Admin() {
  const [rows, setRows] = useState(null);
  const [metrics, setMetrics] = useState(null);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    try {
      const [r, m] = await Promise.all([fetch('/api/admin/submissions'), fetch('/api/admin/metrics')]);
      const j = await r.json();
      if (!r.ok) return setError(j.error || 'Could not load submissions.');
      setError('');
      setRows(j.submissions);
      if (m.ok) setMetrics(await m.json());
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

      {metrics && metrics.total > 0 && (
        <section className={styles.kpis} aria-label="Key metrics">
          <Kpi label="Articles" value={metrics.total} hint={`${metrics.published} published · ${metrics.awaitingRevision} awaiting revision · ${metrics.inReview} in review`} />
          <Kpi label="First-pass rate" value={pctText(metrics.firstPassRatePct)} hint="Published with no revision request" />
          <Kpi label="Avg revision rounds" value={metrics.avgRevisionRounds ?? '-'} hint={`${pctText(metrics.needingRevisionPct)} of articles needed revising`} />
          <Kpi label="Median time to publish" value={durationText(metrics.medianMinutesToPublish)} hint="Includes time waiting for people" />
          <Kpi label="Publish needed a retry" value={pctText(metrics.retriedBeforePublishPct)} hint="Recovered by the engine's retry" />
          <Kpi label="Abandoned" value={pctText(metrics.abandonmentRatePct)} hint="No revision arrived in time" />
        </section>
      )}
      {metrics && metrics.total > 0 && (
        <p className={styles.kpiNote}>Calculated from this app's record of each submission. The engine's own history in Operate is the system of record.</p>
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
                        <div className={styles.taskMeta} title={r.lastNotification}>Revision reason: {reasonPreview(r.lastNotification)}</div>
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

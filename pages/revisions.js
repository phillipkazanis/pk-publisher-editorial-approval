import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import styles from '../styles/App.module.css';

const REFRESH_MS = 6000;

// The reason is the agent's findings, then "Suggested fixes: ...". For the list, show just the first finding.
function preview(reason) {
  const findings = (reason || '').split('Suggested fixes:')[0].split(/;\s+/).map((f) => f.trim().replace(/[.\s]+$/, '')).filter(Boolean);
  if (!findings.length) return '';
  const first = findings[0].length > 150 ? `${findings[0].slice(0, 147)}...` : findings[0];
  return findings.length > 1 ? `${first} (+${findings.length - 1} more)` : first;
}

export default function Revisions() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState(''); // the article being revised
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    try {
      const r = await fetch('/api/revisions');
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Could not load the list.');
        return;
      }
      setError('');
      setItems(j.revisions);
    } catch {
      setError('Could not reach the app.');
    }
  }, []);

  useEffect(() => {
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  function open(item) {
    setOpenId(item.submissionId);
    setTitle(item.title || '');
    setBody(item.body || '');
    setMessage('');
  }

  async function resubmit(e) {
    e.preventDefault();
    setBusy(true);
    setMessage('');
    try {
      const r = await fetch('/api/resubmit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ submissionId: openId, articleTitle: title, articleBody: body }),
      });
      const j = await r.json();
      if (r.ok) {
        setMessage('Resubmitted. The article is being checked again and will leave this list.');
        setOpenId('');
      } else {
        setMessage(`Error: ${j.error}`);
      }
    } catch {
      setMessage('Error: could not reach the app.');
    }
    setBusy(false);
    load();
  }

  return (
    <Layout title="Revisions needed">
      <div className={styles.narrow}>
        <h1 className={styles.title}>Revisions needed</h1>
        <p className={styles.intro}>
          Articles sent back for a revised version. Resubmitting continues the same process instance, so there is one history per article.
        </p>

        {items && items.length > 0 && (
          <div className={styles.summary}>
            <span className={styles.chip}>{items.length} waiting</span>
          </div>
        )}

        {error && (
          <p className={styles.notice} role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className={styles.statusMessage} role="status" aria-live="polite">
            {message}
          </p>
        )}

        {items === null && !error && <p className={styles.empty}>Loading...</p>}
        {items && !items.length && (
          <section className={styles.card}>
            <p className={styles.empty}>No articles are waiting for a revision.</p>
          </section>
        )}

        {(items || []).map((item) => {
          const editing = openId === item.submissionId;
          const summary = preview(item.reason);
          return (
            <section key={item.submissionId} className={styles.card}>
              <div className={styles.itemHead}>
                <div className={styles.itemMain}>
                  <h2 className={styles.cardTitle}>{item.title || '(no headline)'}</h2>
                  <p className={styles.taskMeta}>
                    Revision {item.round} · sent back {new Date(item.updatedAt).toLocaleString('en-AU')} ·{' '}
                    <span className={styles.mono}>{item.submissionId.slice(0, 8)}</span>
                  </p>
                  {summary && !editing && <p className={styles.reasonPreview}>{summary}</p>}
                </div>
                {!editing && (
                  <button className={styles.btnPrimary} type="button" onClick={() => open(item)}>
                    Revise
                  </button>
                )}
              </div>

              {editing && (
                <form onSubmit={resubmit}>
                  {item.reason && (
                    <>
                      <span className={styles.label}>Why it was sent back</span>
                      <p className={styles.reasonBox}>{item.reason}</p>
                    </>
                  )}
                  <label className={styles.label} htmlFor="rev-headline">Headline</label>
                  <input id="rev-headline" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
                  <label className={styles.label} htmlFor="rev-body">Article body</label>
                  <textarea id="rev-body" className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} />
                  {!item.body && <p className={styles.notice}>The earlier text was not saved for this article. Paste the revised article above.</p>}
                  <div className={styles.actions}>
                    <button className={styles.btnPrimary} type="submit" disabled={busy || !body.trim()}>
                      Resubmit revised article
                    </button>
                    <button className={styles.btnSecondary} type="button" disabled={busy} onClick={() => setOpenId('')}>
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </section>
          );
        })}
      </div>
    </Layout>
  );
}

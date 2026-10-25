import { useCallback, useEffect, useState } from 'react';
import Layout from '../components/Layout';
import WordCount, { useLimits } from '../components/WordCount';
import { reasonPreview } from '../lib/reason';
import styles from '../styles/App.module.css';

const REFRESH_MS = 6000;

export default function Revisions() {
  const [items, setItems] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [openId, setOpenId] = useState(''); // the article being revised
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);
  const limits = useLimits();

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
          const summary = reasonPreview(item.reason);
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
                  <WordCount text={body} limits={limits} />
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

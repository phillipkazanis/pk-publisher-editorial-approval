import { useEffect, useState } from 'react';
import Layout from '../components/Layout';
import { CLEAN_HEADLINE, CLEAN_BODY, REVISION_HEADLINE, REVISION_BODY } from '../lib/test-articles';
import styles from '../styles/App.module.css';

// Demo-only helper buttons. Must stay off on production unless the demo is running (see .env.example).
const SHOW_TEST_BUTTONS = process.env.NEXT_PUBLIC_SHOW_TEST_BUTTON === 'true';

const STATUS_LABELS = {
  submitted: 'Submitted',
  revision_requested: 'Revision requested',
  resubmitted: 'Resubmitted',
  published: 'Published',
};

// The status column only tells us: in review (submitted or resubmitted), revision requested, or published.
const STEPS = ['Submitted', 'In review', 'Published'];
function stepStates(s) {
  if (s === 'published') return ['done', 'done', 'done'];
  if (s === 'revision_requested') return ['done', 'attention', 'pending'];
  return ['done', 'current', 'pending'];
}

const POLL_MS = 4000;

export default function Home() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [status, setStatus] = useState('');
  const [trackedId, setTrackedId] = useState('');
  const [latestStatus, setLatestStatus] = useState('');
  const [latestReason, setLatestReason] = useState('');

  // Follow the status of the last submission made from this page until it is published.
  useEffect(() => {
    if (!trackedId) return undefined;
    let cancelled = false;
    let timer;
    async function poll() {
      try {
        const r = await fetch(`/api/submission-status?submissionId=${encodeURIComponent(trackedId)}`);
        if (!r.ok || cancelled) return;
        const j = await r.json();
        if (cancelled) return;
        setLatestStatus(j.status);
        setLatestReason(j.reason || '');
        if (j.status === 'published') clearInterval(timer);
      } catch {
        // Ignore transient errors; the next poll retries.
      }
    }
    poll();
    timer = setInterval(poll, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [trackedId]);

  async function submit(e) {
    e.preventDefault();
    setStatus('Submitting...');
    const r = await fetch('/api/start-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleTitle: title, articleBody: body, submitterEmail: email }),
    });
    const j = await r.json();
    if (!r.ok) return setStatus('Error: ' + j.error);
    setSubmissionId(j.submissionId);
    setTrackedId(j.submissionId);
    setLatestStatus('submitted');
    setStatus('Submitted. Track in Operate; submission ID below.');
  }

  async function resubmit(e) {
    e.preventDefault();
    setStatus('Resubmitting...');
    const r = await fetch('/api/resubmit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, articleTitle: title, articleBody: body }),
    });
    const j = await r.json();
    if (r.ok) {
      setTrackedId(submissionId);
      setLatestStatus('resubmitted');
    }
    setStatus(r.ok ? 'Resubmitted to the same process instance.' : 'Error: ' + j.error);
  }

  // Fill the form only; the user still clicks Submit.
  function loadTestArticle(headline, articleText) {
    setTitle(headline);
    setBody(articleText);
    setStatus('Test article loaded. Click Submit to send it.');
  }

  const statusLabel = latestStatus ? STATUS_LABELS[latestStatus] || latestStatus.replace(/_/g, ' ') : '';
  const states = stepStates(latestStatus);

  return (
    <Layout title="Editorial submission">
      <h1 className={styles.title}>Editorial submission</h1>
      <p className={styles.intro}>
        Submit a draft article for automated checks and editorial approval. Revisions resubmit into the same process instance.
      </p>

      {statusLabel && (
        <section className={styles.card} aria-label="Latest submission status" role="status" aria-live="polite">
          <div className={styles.statusHead}>
            <span className={styles.statusLabel}>Latest submission</span>
            <span className={`${styles.badge} ${styles[`badge_${latestStatus}`] || ''}`}>{statusLabel}</span>
          </div>
          <ol className={styles.tracker} aria-label="Progress">
            {STEPS.map((label, i) => (
              <li
                key={label}
                className={`${styles.step} ${styles[`step_${states[i]}`]}`}
                aria-current={states[i] === 'current' ? 'step' : undefined}
              >
                <span className={styles.dot} aria-hidden="true">
                  {states[i] === 'done' ? '✓' : states[i] === 'attention' ? '!' : i + 1}
                </span>
                {label}
                <span className={styles.srOnly}> ({states[i] === 'attention' ? 'needs revision' : states[i]})</span>
              </li>
            ))}
          </ol>
          {latestStatus === 'revision_requested' && (
            <p className={`${styles.statusNote} ${styles.statusNoteWarn}`}>
              A revision was requested{latestReason ? `: ${latestReason.replace(/[.\s]+$/, '')}.` : '.'} Edit the article below and resubmit it using the submission ID.
            </p>
          )}
          {latestStatus === 'published' && <p className={styles.statusNote}>Published to the mock CMS.</p>}
          {trackedId && (
            <p className={styles.statusNote}>
              Submission ID: <span className={styles.mono}>{trackedId}</span>
            </p>
          )}
        </section>
      )}

      <div className={styles.grid}>
        <div>
          {SHOW_TEST_BUTTONS && (
            <div className={styles.demoTools}>
              <span className={styles.demoToolsLabel}>Demo tools</span>
              <button className={styles.btnSecondary} type="button" onClick={() => loadTestArticle(CLEAN_HEADLINE, CLEAN_BODY)}>
                Load test article
              </button>
              <button className={styles.btnSecondary} type="button" onClick={() => loadTestArticle(REVISION_HEADLINE, REVISION_BODY)}>
                Load revision test article
              </button>
            </div>
          )}

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Submit an article</h2>
            <p className={styles.cardHint}>Starts a new process instance.</p>
            <form onSubmit={submit}>
              <label className={styles.label} htmlFor="headline">Headline</label>
              <input id="headline" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
              <label className={styles.label} htmlFor="body">Article body</label>
              <textarea id="body" className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} />
              <label className={styles.label} htmlFor="email">Submitter email</label>
              <input id="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
              <button className={styles.btnPrimary} type="submit">Submit article</button>
            </form>
          </section>

          <section className={styles.card}>
            <h2 className={styles.cardTitle}>Resubmit a revision</h2>
            <p className={styles.cardHint}>Uses the headline and body above and continues the same process instance.</p>
            <form onSubmit={resubmit}>
              <label className={styles.label} htmlFor="submissionId">Submission ID</label>
              <input id="submissionId" className={styles.input} value={submissionId} onChange={(e) => setSubmissionId(e.target.value)} />
              <button className={styles.btnPrimary} type="submit">Resubmit revised article</button>
            </form>
          </section>

          <p className={styles.statusMessage} aria-live="polite">{status}</p>
        </div>

        <aside className={styles.card}>
          <h2 className={styles.asideTitle}>How this demo works</h2>
          <ol className={styles.asideList}>
            <li>Submit a headline and article body.</li>
            <li>Automated rules and an AI tone check run first.</li>
            <li>If a check fails, a revision request is sent and the process waits for your resubmission.</li>
            <li>If the checks pass, an editor approves or rejects the article in Tasklist.</li>
            <li>A rejection also requests a revision. Resubmit with the same submission ID to continue the same process instance.</li>
            <li>An approved article publishes to a mock CMS. The first attempt fails on purpose and retries automatically.</li>
          </ol>
          <dl className={styles.where}>
            <dt>Approvals</dt>
            <dd>Camunda Tasklist (native task UI)</dd>
            <dt>Audit trail and history</dt>
            <dd>Camunda Operate</dd>
          </dl>
        </aside>
      </div>
    </Layout>
  );
}

import { useEffect, useState } from 'react';
import Head from 'next/head';
import { CLEAN_HEADLINE, CLEAN_BODY, REVISION_HEADLINE, REVISION_BODY } from '../lib/test-articles';
import styles from '../styles/Home.module.css';

// Demo-only helper buttons. Must stay off on production unless the demo is running (see .env.example).
const SHOW_TEST_BUTTONS = process.env.NEXT_PUBLIC_SHOW_TEST_BUTTON === 'true';

// Branding is configured per environment and is not stored in the repo (see .env.example).
const BRAND_NAME = process.env.NEXT_PUBLIC_BRAND_NAME || 'Editorial Console';
const BRAND_LOGO = process.env.NEXT_PUBLIC_BRAND_LOGO || '';

const NAV_ITEMS = ['National', 'World', 'Lifestyle', 'Entertainment', 'Technology', 'Finance', 'Sport'];

const STATUS_LABELS = {
  submitted: 'Submitted',
  revision_requested: 'Revision requested',
  resubmitted: 'Resubmitted',
  published: 'Published',
};

const POLL_MS = 4000;

export default function Home() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [status, setStatus] = useState('');
  const [today, setToday] = useState('');
  const [logoFailed, setLogoFailed] = useState(false);
  const [trackedId, setTrackedId] = useState('');
  const [latestStatus, setLatestStatus] = useState('');

  // Date is set after mount so server and client markup match.
  useEffect(() => {
    setToday(new Date().toLocaleDateString('en-AU', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
  }, []);

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

  return (
    <div className={styles.page}>
      <Head>
        <title>{`${BRAND_NAME} | Editorial submission`}</title>
      </Head>

      <div className={styles.topbar}>
        <div className={styles.topbarInner}>
          <span>{today}</span>
          <span className={styles.demoLabel}>Demo environment</span>
        </div>
      </div>
      <div className={styles.colourStrip} aria-hidden="true" />

      <header className={styles.masthead}>
        {BRAND_LOGO && !logoFailed ? (
          <img className={styles.logo} src={BRAND_LOGO} alt={BRAND_NAME} onError={() => setLogoFailed(true)} />
        ) : (
          <p className={styles.wordmark}>{BRAND_NAME}</p>
        )}
      </header>

      <nav className={styles.nav} aria-label="Sections (placeholder)">
        <ul className={styles.navList}>
          {NAV_ITEMS.map((item) => (
            <li key={item} className={styles.navItem}>
              {item}
            </li>
          ))}
        </ul>
      </nav>

      {statusLabel && (
        <div className={styles.statusStrip} role="status" aria-live="polite">
          <div className={styles.statusInner}>
            <span className={styles.statusLabel}>Latest submission</span>
            <span className={styles.statusValue}>{statusLabel}</span>
          </div>
        </div>
      )}

      <main className={styles.main}>
        <article className={styles.article}>
          <p className={styles.kicker}>Submissions</p>
          <h1 className={styles.headline}>Editorial submission</h1>
          <p className={styles.standfirst}>Submit a draft article. Revisions resubmit into the same process instance.</p>

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

          <form onSubmit={submit}>
            <label className={styles.label} htmlFor="headline">Headline</label>
            <input id="headline" className={styles.input} value={title} onChange={(e) => setTitle(e.target.value)} />
            <label className={styles.label} htmlFor="body">Article body</label>
            <textarea id="body" className={styles.textarea} value={body} onChange={(e) => setBody(e.target.value)} />
            <label className={styles.label} htmlFor="email">Submitter email</label>
            <input id="email" className={styles.input} value={email} onChange={(e) => setEmail(e.target.value)} />
            <button className={styles.btnPrimary} type="submit">Submit article</button>
          </form>

          <hr className={styles.divider} />

          <h2 className={styles.sectionTitle}>Resubmit a revision</h2>
          <form onSubmit={resubmit}>
            <label className={styles.label} htmlFor="submissionId">Submission ID</label>
            <input id="submissionId" className={styles.input} value={submissionId} onChange={(e) => setSubmissionId(e.target.value)} />
            <button className={styles.btnPrimary} type="submit">Resubmit revised article (uses fields above)</button>
          </form>

          <p className={styles.statusMessage} aria-live="polite">{status}</p>
        </article>

        <aside className={styles.aside}>
          <h2 className={styles.asideTitle}>Must read</h2>
          <ol className={styles.asideList}>
            <li>Fill in the headline and body, then submit the article.</li>
            <li>Automated rules and an AI tone check run first.</li>
            <li>If a check fails, a revision request is sent and the process waits for your resubmission.</li>
            <li>If checks pass, an editor approves or rejects the article in Tasklist.</li>
            <li>To resubmit, edit the fields above, keep the submission ID, and use the resubmit button. It continues the same process instance.</li>
            <li>Approved articles publish to a mock CMS. The first attempt fails on purpose and retries automatically.</li>
          </ol>
          <p className={styles.asideNote}>Demo environment. All content on this page is placeholder text.</p>
        </aside>
      </main>

      <footer className={styles.footer}>Demo environment. Not a real publication.</footer>
    </div>
  );
}

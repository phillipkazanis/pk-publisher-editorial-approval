import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useLimits } from '../components/WordCount';
import ViewerSelect, { useViewer } from '../components/ViewerSelect';
import { MANAGER, editorUsernames } from '../lib/editors';
import styles from '../styles/App.module.css';

const REFRESH_MS = 5000;
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
function ArticleStats({ stats, limits }) {
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

export default function Tasks() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [rejectingKey, setRejectingKey] = useState('');
  const [reason, setReason] = useState('');
  const [assignTo, setAssignTo] = useState({});
  const limits = useLimits();
  const [viewer, setViewer] = useViewer();
  const isManager = viewer === MANAGER;

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tasks?viewer=${encodeURIComponent(viewer)}`);
      const j = await r.json();
      if (!r.ok) {
        setError(j.error || 'Could not load tasks.');
        setTasks([]);
        return;
      }
      setError('');
      setTasks(j.tasks);
    } catch {
      setError('Could not reach the app.');
      setTasks([]);
    }
  }, [viewer]);

  useEffect(() => {
    setTasks(null);
    load();
    const timer = setInterval(load, REFRESH_MS);
    return () => clearInterval(timer);
  }, [load]);

  async function decide(taskKey, decision) {
    setBusyKey(taskKey);
    setMessage('');
    try {
      const r = await fetch(`/api/tasks/${taskKey}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const j = await r.json();
      if (!r.ok) {
        setMessage(`Error: ${j.error}`);
      } else {
        setMessage(decision === 'APPROVE' ? 'Approved. The article is being published.' : 'Rejected. A revision request has been sent to the submitter.');
        setRejectingKey('');
        setReason('');
      }
    } catch {
      setMessage('Error: could not reach the app.');
    }
    setBusyKey('');
    load();
  }

  async function reassign(taskKey) {
    const assignee = assignTo[taskKey];
    if (!assignee) return;
    setBusyKey(taskKey);
    setMessage('');
    try {
      const r = await fetch(`/api/tasks/${taskKey}/assign`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ assignee }),
      });
      const j = await r.json();
      setMessage(r.ok ? `Assigned to ${assignee}. It now appears in their list and in their Tasklist.` : `Error: ${j.error}`);
    } catch {
      setMessage('Error: could not reach the app.');
    }
    setBusyKey('');
    load();
  }

  return (
    <Layout title="Editor tasks">
      <h1 className={styles.title}>Editor tasks</h1>
      <p className={styles.intro}>
        Articles waiting for editorial approval. The manager assigns work; an editor sees only the tasks assigned to them, decides on them, and can hand one to
        another editor (for example when going on leave).
      </p>
      <ViewerSelect value={viewer} onChange={(v) => { setViewer(v); setMessage(''); setRejectingKey(''); }} />

      {error && (
        <p className={styles.notice} role="alert">
          {error} You can still approve in Camunda Tasklist.
        </p>
      )}
      {message && (
        <p className={styles.statusMessage} role="status" aria-live="polite">
          {message}
        </p>
      )}

      {tasks === null && <p className={styles.empty}>Loading...</p>}
      {tasks && !tasks.length && !error && (
        <section className={styles.card}>
          <p className={styles.empty}>
            {isManager
              ? 'No articles are waiting for approval. An article reaches an editor only after it passes both the rules check and the AI review.'
              : `Nothing is assigned to ${viewer}. The manager assigns tasks.`}{' '}
            Articles that failed a check are under <Link href="/revisions">Revisions</Link>.
          </p>
        </section>
      )}

      {(tasks || []).map((t) => (
        <section key={t.taskKey} className={styles.card}>
          <h2 className={styles.cardTitle}>{t.articleTitle || '(no headline)'}</h2>
          <p className={styles.taskMeta}>
            {t.submittedBy ? `Written by ${t.submittedBy} · ` : ''}
            {t.revisionRound > 1 ? `Revision round ${t.revisionRound} · ` : ''}
            {t.assignee ? `Assigned to ${t.assignee} · ` : 'Unassigned · '}
            Waiting since {new Date(t.created).toLocaleString('en-AU')}
          </p>
          {t.aiSummary && (
            <>
              <h3 className={styles.subTitle}>Summary (AI, for the editor)</h3>
              <p className={styles.summaryText}>{t.aiSummary}</p>
            </>
          )}
          {!t.variablesError && t.stats && <ArticleStats stats={t.stats} limits={limits} />}
          {t.variablesError ? (
            <p className={styles.notice}>The article text could not be loaded for this task. Review it in Camunda Tasklist.</p>
          ) : (
            <pre className={styles.articleBody}>{t.articleBody}</pre>
          )}
          <h3 className={styles.subTitle}>Checks</h3>
          <ul className={styles.checks}>
            <li>
              Rules check:{' '}
              <span className={t.rulesVerdict === 'PASS' ? styles.checkOk : styles.checkFail}>{t.rulesVerdict || 'n/a'}</span>
              {t.rulesReason ? ` (${t.rulesReason})` : ''}
            </li>
            <li>
              AI compliance review:{' '}
              <span className={/PASS/i.test(t.aiVerdict || '') ? styles.checkOk : styles.checkFail}>{t.aiVerdict || 'n/a'}</span>
              {t.aiRulesChecked.length ? ` (style rules checked: ${t.aiRulesChecked.join(', ')})` : ''}
            </li>
            {t.aiWarnings.map((w, i) => (
              <li key={`w${i}`}>
                <span className={styles.checkFail}>Warning:</span> {w}
              </li>
            ))}
            {t.aiReasons.map((r, i) => (
              <li key={`r${i}`}>
                <span className={styles.checkFail}>Reason:</span> {r}
              </li>
            ))}
          </ul>
          {t.claimsNeedingSources.length > 0 && (
            <>
              <h3 className={styles.subTitle}>Claims with no named source (check before approving)</h3>
              <ul className={styles.checks}>
                {t.claimsNeedingSources.map((c, i) => (
                  <li key={`c${i}`}>{c}</li>
                ))}
              </ul>
            </>
          )}
          {t.aiSuggestedFixes.length > 0 && (
            <>
              <h3 className={styles.subTitle}>AI suggestions</h3>
              <ul className={styles.checks}>
                {t.aiSuggestedFixes.map((f, i) => (
                  <li key={`f${i}`}>{f}</li>
                ))}
              </ul>
            </>
          )}

          <div className={`${styles.actions} ${styles.reassign}`}>
            <label className={styles.label} htmlFor={`assign-${t.taskKey}`}>{t.assignee ? 'Reassign to' : 'Assign to'}</label>
            <select
              id={`assign-${t.taskKey}`}
              className={styles.input}
              value={assignTo[t.taskKey] || ''}
              onChange={(e) => setAssignTo({ ...assignTo, [t.taskKey]: e.target.value })}
            >
              <option value="">Choose an editor</option>
              {editorUsernames().filter((u) => u !== t.assignee && u !== viewer).map((u) => (
                <option key={u} value={u}>{u}</option>
              ))}
            </select>
            <button className={styles.btnSecondary} type="button" disabled={busyKey === t.taskKey || !assignTo[t.taskKey]} onClick={() => reassign(t.taskKey)}>
              {t.assignee ? 'Reassign' : 'Assign'}
            </button>
          </div>

          {isManager ? (
            <p className={styles.taskMeta}>
              {t.assignee ? `${t.assignee} decides on this task.` : 'Assign it to an editor. The assigned editor decides.'}
            </p>
          ) : rejectingKey === t.taskKey ? (
            <div>
              <label className={styles.label} htmlFor={`reason-${t.taskKey}`}>Reason for revision (shown to the submitter)</label>
              <textarea
                id={`reason-${t.taskKey}`}
                className={styles.textarea}
                style={{ height: 100 }}
                value={reason}
                onChange={(e) => setReason(e.target.value)}
              />
              <div className={styles.actions}>
                <button
                  className={styles.btnDanger}
                  type="button"
                  disabled={busyKey === t.taskKey || !reason.trim()}
                  onClick={() => decide(t.taskKey, 'REJECT')}
                >
                  Confirm rejection
                </button>
                <button className={styles.btnSecondary} type="button" disabled={busyKey === t.taskKey} onClick={() => { setRejectingKey(''); setReason(''); }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={styles.actions}>
              <button className={styles.btnPrimary} type="button" disabled={busyKey === t.taskKey} onClick={() => decide(t.taskKey, 'APPROVE')}>
                Approve
              </button>
              <button className={styles.btnDanger} type="button" disabled={busyKey === t.taskKey} onClick={() => { setRejectingKey(t.taskKey); setReason(''); }}>
                Reject
              </button>
            </div>
          )}
        </section>
      ))}
    </Layout>
  );
}

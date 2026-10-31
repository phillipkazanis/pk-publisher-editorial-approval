import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import Layout from '../components/Layout';
import { useLimits } from '../components/WordCount';
import ViewerSelect, { useViewer } from '../components/ViewerSelect';
import TaskList from '../components/editor/TaskList';
import ArticlePanel from '../components/editor/ArticlePanel';
import RulesCard from '../components/editor/RulesCard';
import AiCard from '../components/editor/AiCard';
import HistoryCard from '../components/editor/HistoryCard';
import DecisionBar from '../components/editor/DecisionBar';
import { Skeleton } from '../components/editor/Panel';
import { aiFindings } from '../lib/editor-view';
import { MANAGER } from '../lib/editors';
import styles from '../styles/App.module.css';
import s from '../styles/EditorView.module.css';

const REFRESH_MS = 5000;
const WIDE_BREAKPOINT = 1100;

// Editor tasks: a task list on the left, and for the selected task the article beside what the automated rules and the AI found,
// with the decision bar underneath. Layout and data loading are unchanged: this reuses /api/tasks and its complete and assign routes.
export default function Tasks() {
  const [tasks, setTasks] = useState(null);
  const [error, setError] = useState('');
  const [message, setMessage] = useState('');
  const [busyKey, setBusyKey] = useState('');
  const [selectedKey, setSelectedKey] = useState('');
  const detailRef = useRef(null);
  const viewerRef = useRef('');
  const limits = useLimits();
  const [viewer, setViewer] = useViewer();
  const isManager = viewer === MANAGER;

  viewerRef.current = viewer;

  const load = useCallback(async () => {
    try {
      const r = await fetch(`/api/tasks?viewer=${encodeURIComponent(viewer)}`);
      const j = await r.json();
      // A slow response for a viewer who has since been switched away from must not replace the current list.
      if (viewerRef.current !== viewer) return;
      if (!r.ok) {
        setError(j.error || 'Could not load tasks.');
        setTasks([]);
        return;
      }
      setError('');
      setTasks(j.tasks);
    } catch {
      if (viewerRef.current !== viewer) return;
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

  // The selected task, or the oldest one when nothing is selected or the selection has left the list (for example after a decision).
  const task = useMemo(() => (tasks || []).find((t) => t.taskKey === selectedKey) || (tasks || [])[0] || null, [tasks, selectedKey]);
  const findings = useMemo(() => (task ? aiFindings(task) : []), [task]);
  const excerpts = useMemo(() => findings.flatMap((f) => f.excerpts), [findings]);

  function select(key) {
    setSelectedKey(key);
    setMessage('');
    // On a narrow screen the list sits above the detail, so bring the detail into view.
    if (typeof window !== 'undefined' && window.innerWidth < WIDE_BREAKPOINT) detailRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  async function decide(taskKey, decision, reason) {
    setBusyKey(taskKey);
    setMessage('');
    try {
      const r = await fetch(`/api/tasks/${taskKey}/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ decision, reason }),
      });
      const j = await r.json();
      setMessage(
        !r.ok
          ? `Error: ${j.error}`
          : decision === 'APPROVE'
            ? 'Approved. The article is being published.'
            : 'Revision requested. The comment has been sent to the writer.'
      );
    } catch {
      setMessage('Error: could not reach the app.');
    }
    setBusyKey('');
    load();
  }

  async function reassign(taskKey, assignee) {
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
      <div className={s.root}>
        <div className={s.head}>
          <h1>Editor tasks</h1>
          <p>
            Articles waiting for editorial approval. The manager assigns work; an editor sees only the tasks assigned to them, decides on them, and can hand one to
            another editor (for example when going on leave).
          </p>
        </div>
        <ViewerSelect value={viewer} onChange={(v) => { setViewer(v); setMessage(''); setSelectedKey(''); }} />

        {error && (
          <p className={styles.notice} role="alert">
            {error} You can still approve in Camunda Tasklist.
          </p>
        )}
        {message && (
          <p className={styles.statusMessage} role="status" aria-live="polite" style={{ marginBottom: 12 }}>
            {message}
          </p>
        )}

        <div className={s.shell}>
          <TaskList tasks={tasks} selectedKey={task?.taskKey} onSelect={select} error={error} />

          <div className={s.detail} ref={detailRef}>
            {tasks === null && (
              <section className={styles.card}>
                <Skeleton lines={5} />
              </section>
            )}
            {tasks && !task && !error && (
              <section className={styles.card}>
                <p className={styles.empty}>
                  {isManager
                    ? 'No articles are waiting for approval. An article reaches an editor only after it passes both the rules check and the AI review.'
                    : `Nothing is assigned to ${viewer}. The manager assigns tasks.`}{' '}
                  Articles that failed a check are under <Link href="/revisions">Revisions</Link>.
                </p>
              </section>
            )}
            {task && (
              <>
                <div className={s.columns}>
                  <ArticlePanel task={task} excerpts={excerpts} limits={limits} />
                  <div className={s.stack}>
                    <RulesCard task={task} limits={limits} />
                    <AiCard task={task} findings={findings} />
                    <HistoryCard key={task.taskKey} task={task} />
                  </div>
                </div>
                <DecisionBar
                  key={task.taskKey}
                  task={task}
                  viewer={viewer}
                  isManager={isManager}
                  busy={busyKey === task.taskKey}
                  onApprove={() => decide(task.taskKey, 'APPROVE', '')}
                  onRevise={(reason) => decide(task.taskKey, 'REJECT', reason)}
                  onReassign={(assignee) => reassign(task.taskKey, assignee)}
                />
              </>
            )}
          </div>
        </div>
      </div>
    </Layout>
  );
}

import { useEffect, useState } from 'react';
import Panel, { Skeleton } from './Panel';
import s from '../../styles/EditorView.module.css';

// Earlier rounds. Only what really exists: the number of times the article was sent back (the revisionRound variable) and the
// latest revision request, from the existing /api/submission-status route (Supabase). Earlier texts are not stored, so there is
// no "what changed" diff. The card is omitted on a first submission, or when nothing could be read.
export default function HistoryCard({ task }) {
  const wanted = task.revisionRound > 1 && Boolean(task.submissionId);
  const [state, setState] = useState({ loading: wanted, reason: null });

  useEffect(() => {
    if (!wanted) return undefined;
    let off = false;
    fetch(`/api/submission-status?submissionId=${encodeURIComponent(task.submissionId)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => !off && setState({ loading: false, reason: typeof j?.reason === 'string' && j.reason ? j.reason : null }))
      .catch(() => !off && setState({ loading: false, reason: null }));
    return () => {
      off = true;
    };
  }, [wanted, task.submissionId]);

  if (!wanted) return null;
  if (state.loading) {
    return (
      <Panel band="history" icon="history" title="History">
        <Skeleton lines={2} />
      </Panel>
    );
  }
  if (!state.reason) return null;
  const earlier = task.revisionRound - 1;
  return (
    <Panel band="history" icon="history" title="History">
      <p style={{ margin: 0, fontSize: 14 }}>
        This is revision {task.revisionRound}. It was sent back {earlier} {earlier === 1 ? 'time' : 'times'} before.
      </p>
      <p className={s.findingsTitle}>Latest revision request</p>
      <p className={s.quote}>{state.reason}</p>
      <p className={s.note}>Earlier versions of the text are not stored, so changes between rounds cannot be shown.</p>
    </Panel>
  );
}

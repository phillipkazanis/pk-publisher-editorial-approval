import { useState } from 'react';
import { editorUsernames } from '../../lib/editors';
import Icon from './Icon';
import s from '../../styles/EditorView.module.css';

// Sticky decision bar. The assigned editor approves or requests a revision (the comment is required and is shown to the writer);
// anyone can reassign. The manager only assigns: the assigned editor decides. Keyed by task, so a half-written comment survives
// the 5 second refresh but never carries over to another task.
export default function DecisionBar({ task, viewer, isManager, busy, onApprove, onRevise, onReassign }) {
  const [revising, setRevising] = useState(false);
  const [reason, setReason] = useState('');
  const [assignee, setAssignee] = useState('');
  const options = editorUsernames().filter((u) => u !== task.assignee && u !== viewer);
  const id = `decision-${task.taskKey}`;

  return (
    <section className={s.decision} aria-labelledby={`${id}-title`}>
      <h2 className={s.decisionTitle} id={`${id}-title`}>
        Decision
      </h2>

      {!isManager && revising && (
        <div className={s.reviseBox}>
          <label htmlFor={`${id}-reason`}>Comment for the writer (required)</label>
          <textarea id={`${id}-reason`} className={s.field} value={reason} onChange={(e) => setReason(e.target.value)} required aria-required="true" autoFocus />
        </div>
      )}

      <div className={s.decisionRow}>
        {isManager ? (
          <span className={s.hint} style={{ margin: 0 }}>
            {task.assignee ? `${task.assignee} decides on this task.` : 'Assign it to an editor. The assigned editor decides.'}
          </span>
        ) : revising ? (
          <>
            <button type="button" className={`${s.btn} ${s.btnRevise}`} disabled={busy || !reason.trim()} onClick={() => onRevise(reason.trim())}>
              <Icon name="edit" />
              Send revision request
            </button>
            <button type="button" className={`${s.btn} ${s.btnOutline}`} disabled={busy} onClick={() => { setRevising(false); setReason(''); }}>
              Cancel
            </button>
          </>
        ) : (
          <>
            <button type="button" className={`${s.btn} ${s.btnApprove}`} disabled={busy} onClick={onApprove}>
              <Icon name="check" />
              Approve
            </button>
            <button type="button" className={`${s.btn} ${s.btnRevise}`} disabled={busy} onClick={() => setRevising(true)}>
              <Icon name="edit" />
              Request revision
            </button>
          </>
        )}

        <span className={s.spacer} />
        <label className={s.assignLabel} htmlFor={`${id}-assign`}>
          {task.assignee ? 'Reassign to' : 'Assign to'}
        </label>
        <select id={`${id}-assign`} className={s.field} value={assignee} onChange={(e) => setAssignee(e.target.value)}>
          <option value="">Choose an editor</option>
          {options.map((u) => (
            <option key={u} value={u}>
              {u}
            </option>
          ))}
        </select>
        <button type="button" className={`${s.btn} ${s.btnOutline}`} disabled={busy || !assignee} onClick={() => onReassign(assignee)}>
          <Icon name="swap" />
          {task.assignee ? 'Reassign' : 'Assign'}
        </button>
      </div>
    </section>
  );
}

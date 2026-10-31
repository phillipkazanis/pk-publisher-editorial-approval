import { taskStatus } from '../../lib/editor-view';
import Icon from './Icon';
import { Skeleton, State } from './Panel';
import s from '../../styles/EditorView.module.css';

const STATUS_STYLE = {
  pass: { tone: 'ok', icon: 'check' },
  attention: { tone: 'warn', icon: 'alert' },
  none: { tone: 'muted', icon: 'info' },
};

// Left rail: one button per open task, oldest first (the API sorts them). tasks === null means still loading.
export default function TaskList({ tasks, selectedKey, onSelect, error }) {
  return (
    <nav className={s.rail} aria-label="Tasks waiting for approval">
      <h2 className={s.railTitle}>Waiting for approval{tasks ? ` (${tasks.length})` : ''}</h2>
      {tasks === null && <Skeleton lines={4} />}
      {tasks && !tasks.length && <State>{error ? 'Tasks could not be loaded.' : 'No tasks.'}</State>}
      <ul className={s.taskList}>
        {(tasks || []).map((t) => {
          const status = taskStatus(t);
          const look = STATUS_STYLE[status.key];
          const active = t.taskKey === selectedKey;
          return (
            <li key={t.taskKey}>
              <button type="button" className={`${s.taskBtn} ${active ? s.taskBtnActive : ''}`} aria-current={active ? 'true' : undefined} onClick={() => onSelect(t.taskKey)}>
                <span className={s.taskHeadline}>{t.articleTitle || '(no headline)'}</span>
                <span className={s.taskSub}>
                  <span>{t.submittedBy || 'Unknown writer'}</span>
                  <span className={s.badge}>Round {t.revisionRound}</span>
                  <span className={`${s.chip} ${s[`tone_${look.tone}`]}`}>
                    <Icon name={look.icon} />
                    {status.label}
                  </span>
                </span>
                <span className={s.taskSub}>{t.assignee ? `Assigned to ${t.assignee}` : 'Unassigned'}</span>
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

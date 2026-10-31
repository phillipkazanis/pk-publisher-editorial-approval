import { highlightSegments } from '../../lib/editor-view';
import ArticleStats from './ArticleStats';
import Icon from './Icon';
import Panel, { State } from './Panel';
import s from '../../styles/EditorView.module.css';

const fmt = (n) => Number(n).toLocaleString('en-AU');

// The article exactly as submitted. Text is rendered as React text nodes (never as HTML), so submitted content cannot inject markup.
// Highlighting only marks passages the AI review quoted word for word (see lib/editor-view.js).
export default function ArticlePanel({ task, excerpts, limits }) {
  const words = task.wordCount ?? task.stats?.words;
  const segments = highlightSegments(task.articleBody, excerpts);
  const hasMarks = segments.some((x) => x.mark);
  return (
    <Panel
      band="article"
      icon="doc"
      title="Article"
      aside={
        <span className={s.draftLabel}>
          <Icon name="edit" />
          Draft - not published
        </span>
      }
    >
      <h3 className={s.headline}>{task.articleTitle || '(no headline)'}</h3>
      <p className={s.byline}>
        {task.submittedBy && (
          <span>
            By <strong>{task.submittedBy}</strong>
          </span>
        )}
        <span>Waiting since {new Date(task.created).toLocaleString('en-AU')}</span>
        <span className={s.badge}>{task.revisionRound > 1 ? `Revision ${task.revisionRound}` : 'First submission'}</span>
        {Number.isFinite(words) && <span>{fmt(words)} words</span>}
      </p>
      {task.variablesError ? (
        <State kind="error">The article text could not be loaded for this task. Review it in Camunda Tasklist.</State>
      ) : !task.articleBody ? (
        <State>This task has no article text.</State>
      ) : (
        <>
          <p className={s.articleText}>
            {segments.map((seg, i) => (seg.mark ? <mark key={i}>{seg.text}</mark> : <span key={i}>{seg.text}</span>))}
          </p>
          {hasMarks && (
            <p className={s.markKey}>
              <mark>Highlighted</mark> passages are quoted word for word by the AI review.
            </p>
          )}
          {task.stats && (
            <details className={s.statsBlock}>
              <summary>Text statistics</summary>
              <ArticleStats stats={task.stats} limits={limits} />
            </details>
          )}
        </>
      )}
    </Panel>
  );
}

import { wordCountState } from '../../lib/editor-view';
import Icon from './Icon';
import Panel, { State, VerdictPill } from './Panel';
import s from '../../styles/EditorView.module.css';

const fmt = (n) => Number(n).toLocaleString('en-AU');

const WORD_STATE = {
  ok: { tone: 'ok', icon: 'check', text: 'Within limit' },
  over: { tone: 'bad', icon: 'x', text: 'Over limit' },
  under: { tone: 'bad', icon: 'x', text: 'Under limit' },
};

// What the DMN rules decided. The DMN returns only verdict and reason, so everything else here is read from the
// task itself (word count, headline) or the limits the rules use (/api/limits).
export default function RulesCard({ task, limits }) {
  const verdict = task.rulesVerdict;
  const kind = verdict === 'PASS' ? 'pass' : verdict === 'FAIL' ? 'fail' : 'other';
  const words = task.wordCount ?? task.stats?.words;
  const wState = wordCountState(words, limits);
  const hasHeadline = typeof task.articleTitle === 'string' && task.articleTitle.trim().length > 0;
  const limitText = limits?.minWordCount && limits?.maxWordCount ? `${fmt(limits.minWordCount)} to ${fmt(limits.maxWordCount)}` : limits?.maxWordCount ? `up to ${fmt(limits.maxWordCount)}` : limits?.minWordCount ? `at least ${fmt(limits.minWordCount)}` : '';

  return (
    <Panel band="rules" icon="rules" title="Rules check (DMN)" aside={verdict ? <VerdictPill kind={kind}>{kind === 'pass' ? 'Pass' : kind === 'fail' ? 'Fail' : verdict}</VerdictPill> : null}>
      {!verdict ? (
        <State>No rules result was recorded for this task.</State>
      ) : (
        <>
          <ul className={s.rows}>
            {Number.isFinite(words) && (
              <li className={s.row}>
                <span className={s.rowLabel}>Word count</span>
                <span className={s.chips}>
                  <span>
                    {fmt(words)}
                    {limitText ? ` (limit ${limitText})` : ''}
                  </span>
                  {WORD_STATE[wState] && (
                    <span className={`${s.chip} ${s[`tone_${WORD_STATE[wState].tone}`]}`}>
                      <Icon name={WORD_STATE[wState].icon} />
                      {WORD_STATE[wState].text}
                    </span>
                  )}
                </span>
              </li>
            )}
            {(task.bannedTerms.length > 0 || verdict === 'PASS') && (
              <li className={s.row}>
                <span className={s.rowLabel}>Banned terms</span>
                {task.bannedTerms.length ? (
                  <span className={s.chips}>
                    {task.bannedTerms.map((t) => (
                      <span key={t} className={s.bannedChip}>
                        <Icon name="x" /> {t}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span className={s.chips}>
                    <span className={`${s.chip} ${s.tone_ok}`}>
                      <Icon name="check" />
                      None found
                    </span>
                  </span>
                )}
              </li>
            )}
            <li className={s.row}>
              <span className={s.rowLabel}>Headline</span>
              <span className={s.chips}>
                <span className={`${s.chip} ${hasHeadline ? s.tone_ok : s.tone_bad}`}>
                  <Icon name={hasHeadline ? 'check' : 'x'} />
                  {hasHeadline ? 'Present' : 'Missing'}
                </span>
              </span>
            </li>
          </ul>
          {verdict !== 'PASS' && task.rulesReason && <p className={s.reasonLine}>{task.rulesReason}</p>}
        </>
      )}
    </Panel>
  );
}

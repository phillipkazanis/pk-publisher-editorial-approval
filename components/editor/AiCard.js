import { aiVerdictKind } from '../../lib/editor-view';
import Icon from './Icon';
import Panel, { State, VerdictPill } from './Panel';
import s from '../../styles/EditorView.module.css';

// Severity comes from which list the AI put the finding in: the contract has no severity field.
const SEVERITY = {
  reason: { label: 'Must fix', icon: 'x', tone: 'bad' },
  warning: { label: 'Warning', icon: 'alert', tone: 'warn' },
  claim: { label: 'Check source', icon: 'info', tone: 'info' },
};

// The AI review: advisory only. `findings` come from aiFindings(task); `matched` means the finding quotes the article exactly,
// and that passage is highlighted in the Article panel.
export default function AiCard({ task, findings }) {
  const kind = aiVerdictKind(task.aiVerdict);
  const hasAnything = kind !== 'none' || task.aiSummary || findings.length || task.aiSuggestedFixes.length;
  return (
    <Panel
      band="ai"
      icon="ai"
      title="AI compliance review"
      aside={
        <span className={s.advisory}>
          <Icon name="ai" />
          AI-generated, advisory
        </span>
      }
    >
      {!hasAnything ? (
        <State>No AI review result was recorded for this task.</State>
      ) : (
        <>
          {kind !== 'none' && (
            <p style={{ margin: '0 0 12px' }}>
              <VerdictPill kind={kind}>{kind === 'pass' ? 'Pass' : kind === 'fail' ? 'Fail' : task.aiVerdict}</VerdictPill>
            </p>
          )}
          {task.aiSummary && <p className={s.summaryText}>{task.aiSummary}</p>}
          {findings.length > 0 && (
            <>
              <h3 className={s.findingsTitle}>Findings ({findings.length})</h3>
              <ul className={s.findings}>
                {findings.map((f) => {
                  const sev = SEVERITY[f.kind];
                  return (
                    <li key={f.id} className={`${s.finding} ${s[`sev_${f.kind}`]}`}>
                      <span className={s.findingHead}>
                        <span className={`${s.tag} ${s[`tone_${sev.tone}`]}`}>
                          <Icon name={sev.icon} />
                          {sev.label}
                        </span>
                        {f.matched && (
                          <span className={`${s.tag} ${s.tone_muted}`}>
                            <Icon name="marker" />
                            Highlighted in article
                          </span>
                        )}
                      </span>
                      <p className={s.findingText}>{f.text}</p>
                    </li>
                  );
                })}
              </ul>
            </>
          )}
          {task.aiSuggestedFixes.length > 0 && (
            <>
              <h3 className={s.findingsTitle}>Suggested fixes</h3>
              <ul className={s.findings}>
                {task.aiSuggestedFixes.map((fix, i) => (
                  <li key={i} className={s.finding}>
                    <p className={s.findingText}>{fix}</p>
                  </li>
                ))}
              </ul>
            </>
          )}
          {task.aiRulesChecked.length > 0 && <p className={s.checkedLine}>Style rules checked: {task.aiRulesChecked.join(', ')}</p>}
        </>
      )}
      <p className={s.finalCall}>
        <Icon name="gavel" /> Editor makes the final call.
      </p>
    </Panel>
  );
}

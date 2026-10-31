import { useId } from 'react';
import Icon from './Icon';
import s from '../../styles/EditorView.module.css';

// A card with a coloured band, an icon and a text label. band: rules | ai | history | article.
export default function Panel({ band, icon, title, aside, children }) {
  const id = useId();
  return (
    <section className={`${s.panel} ${s[`band_${band}`]}`} aria-labelledby={id}>
      <div className={s.panelHead}>
        <h2 className={s.panelTitle} id={id}>
          <Icon name={icon} />
          {title}
        </h2>
        {aside}
      </div>
      <div className={s.panelBody}>{children}</div>
    </section>
  );
}

// An empty, loading or error line inside a panel.
export function State({ kind = 'empty', children }) {
  return (
    <p className={`${s.stateBox} ${kind === 'error' ? s.stateError : ''}`} role={kind === 'error' ? 'alert' : undefined}>
      <Icon name={kind === 'error' ? 'alert' : 'info'} />
      {children}
    </p>
  );
}

export function Skeleton({ lines = 3 }) {
  return (
    <div aria-busy="true">
      <span className={s.srOnly}>Loading</span>
      {Array.from({ length: lines }, (_, i) => (
        <div key={i} className={s.skeleton} style={{ width: `${95 - i * 18}%` }} />
      ))}
    </div>
  );
}

// Verdict pill: a word and an icon as well as a colour.
export function VerdictPill({ kind, children }) {
  const tone = kind === 'pass' ? 'ok' : kind === 'fail' ? 'bad' : 'warn';
  return (
    <span className={`${s.pill} ${s[`tone_${tone}`]}`}>
      <Icon name={kind === 'pass' ? 'check' : kind === 'fail' ? 'x' : 'alert'} />
      {children}
    </span>
  );
}

import s from '../../styles/EditorView.module.css';

// Small inline icons (decorative: every use sits next to a text label, so they are hidden from screen readers).
const PATHS = {
  check: <path d="M20 6 9 17l-5-5" />,
  x: <path d="M18 6 6 18M6 6l12 12" />,
  alert: <path d="M12 3 2 20h20L12 3zM12 10v4M12 17.5v.01" />,
  info: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 16v-4M12 8v.01" />
    </>
  ),
  rules: <path d="m9 11 3 3 8-8M20 12v7a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h9" />,
  ai: <path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8L12 3zM19 16l.7 2 2 .7-2 .7-.7 2-.7-2-2-.7 2-.7.7-2z" />,
  history: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  doc: <path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8l-5-5zM14 3v5h5M9 13h6M9 17h6" />,
  swap: <path d="m16 3 4 4-4 4M20 7H8M8 21l-4-4 4-4M4 17h12" />,
  edit: <path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" />,
  marker: <path d="m9 11-6 6v3h9l3-3M22 12l-4.6 4.6a2 2 0 0 1-2.8 0l-5.2-5.2a2 2 0 0 1 0-2.8L14 4" />,
  gavel: <path d="m14 13-8.4 8.4a2 2 0 0 1-2.8-2.8L11 10M16 16l6-6M8 8l6-6M9 7l8 8M21 11l-8-8" />,
};

export default function Icon({ name }) {
  return (
    <svg className={s.icon} viewBox="0 0 24 24" aria-hidden="true" focusable="false">
      {PATHS[name]}
    </svg>
  );
}

// Usernames offered in the "Reassign to" list on the Editor tasks page. They must match real Camunda usernames,
// because the task then appears in that user's Tasklist. Override with NEXT_PUBLIC_EDITOR_USERNAMES="john,alice".
const DEFAULT_EDITORS = ['john', 'alice'];

export const EDITOR_USERNAMES = (process.env.NEXT_PUBLIC_EDITOR_USERNAMES || '')
  .split(',')
  .map((s) => s.trim())
  .filter(Boolean);

export const editorUsernames = () => (EDITOR_USERNAMES.length ? EDITOR_USERNAMES : DEFAULT_EDITORS);

// Same shape the API route accepts; keeps stray characters out of the request.
export const isValidAssignee = (v) => typeof v === 'string' && /^[A-Za-z0-9._@-]{1,100}$/.test(v);

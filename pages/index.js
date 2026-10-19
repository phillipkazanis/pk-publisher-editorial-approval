import { useState } from 'react';

const box = { maxWidth: 640, margin: '40px auto', fontFamily: 'system-ui, sans-serif', padding: 16 };
const input = { width: '100%', padding: 8, marginBottom: 12, boxSizing: 'border-box' };
const btn = { padding: '8px 16px', cursor: 'pointer' };

export default function Home() {
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [email, setEmail] = useState('');
  const [submissionId, setSubmissionId] = useState('');
  const [status, setStatus] = useState('');

  async function submit(e) {
    e.preventDefault();
    setStatus('Submitting...');
    const r = await fetch('/api/start-process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ articleTitle: title, articleBody: body, submitterEmail: email }),
    });
    const j = await r.json();
    if (!r.ok) return setStatus('Error: ' + j.error);
    setSubmissionId(j.submissionId);
    setStatus('Submitted. Track in Operate; submission ID below.');
  }

  async function resubmit(e) {
    e.preventDefault();
    setStatus('Resubmitting...');
    const r = await fetch('/api/resubmit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ submissionId, articleTitle: title, articleBody: body }),
    });
    const j = await r.json();
    setStatus(r.ok ? 'Resubmitted to the same process instance.' : 'Error: ' + j.error);
  }

  return (
    <main style={box}>
      <h1>Editorial submission</h1>
      <p>Submit a draft article. Revisions resubmit into the same process instance.</p>
      <form onSubmit={submit}>
        <label>Headline</label>
        <input style={input} value={title} onChange={(e) => setTitle(e.target.value)} />
        <label>Article body</label>
        <textarea style={{ ...input, height: 180 }} value={body} onChange={(e) => setBody(e.target.value)} />
        <label>Submitter email</label>
        <input style={input} value={email} onChange={(e) => setEmail(e.target.value)} />
        <button style={btn} type="submit">Submit article</button>
      </form>
      <hr />
      <form onSubmit={resubmit}>
        <label>Submission ID</label>
        <input style={input} value={submissionId} onChange={(e) => setSubmissionId(e.target.value)} />
        <button style={btn} type="submit">Resubmit revised article (uses fields above)</button>
      </form>
      <p>{status}</p>
    </main>
  );
}

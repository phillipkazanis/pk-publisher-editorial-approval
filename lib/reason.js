// The revision reason is the agent's findings, then "Suggested fixes: ...". For lists, show just the first finding.
export function reasonPreview(reason) {
  const findings = (reason || '').split('Suggested fixes:')[0].split(/;\s+/).map((f) => f.trim().replace(/[.\s]+$/, '')).filter(Boolean);
  if (!findings.length) return '';
  const first = findings[0].length > 150 ? `${findings[0].slice(0, 147)}...` : findings[0];
  return findings.length > 1 ? `${first} (+${findings.length - 1} more)` : first;
}

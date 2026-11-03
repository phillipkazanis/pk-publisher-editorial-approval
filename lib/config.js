// Public (non-secret) app configuration. NEXT_PUBLIC_ variables are inlined at build time,
// so each one must be referenced literally as process.env.NEXT_PUBLIC_NAME.

const DEFAULT_OPTIMIZE_DASHBOARD_URL =
  'https://syd-1.optimize.camunda.io/11d7b228-34ce-435a-8780-37c035308e42/#/collection/216f971b-dd60-484f-9055-586f1f1c4702/dashboard/890ca2e8-6eb1-44a3-be23-7ca9ae67935e/';

// Returns the Optimize dashboard URL, or '' when the configured value is not a valid http(s) URL.
// An unset variable falls back to the default; an explicitly empty one is treated as unset too.
export function getOptimizeDashboardUrl() {
  const raw = (process.env.NEXT_PUBLIC_OPTIMIZE_DASHBOARD_URL || '').trim() || DEFAULT_OPTIMIZE_DASHBOARD_URL;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

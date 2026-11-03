// Public (non-secret) app configuration. NEXT_PUBLIC_ variables are inlined at build time,
// so each one must be referenced literally as process.env.NEXT_PUBLIC_NAME.

const DEFAULT_OPTIMIZE_DASHBOARD_URL =
  'https://syd-1.optimize.camunda.io/11d7b228-34ce-435a-8780-37c035308e42/#/collection/216f971b-dd60-484f-9055-586f1f1c4702/dashboard/890ca2e8-6eb1-44a3-be23-7ca9ae67935e/';

const DEFAULT_AI_ANALYTICS_URL =
  'https://syd-1.optimize.camunda.io/11d7b228-34ce-435a-8780-37c035308e42/#/agentic-control-plane';

// Returns a valid http(s) URL from the configured value (or the default), else ''.
// An unset or empty variable falls back to the default; an invalid one hides the link.
function validUrl(configured, fallback) {
  const raw = (configured || '').trim() || fallback;
  try {
    const url = new URL(raw);
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.href : '';
  } catch {
    return '';
  }
}

export function getOptimizeDashboardUrl() {
  return validUrl(process.env.NEXT_PUBLIC_OPTIMIZE_DASHBOARD_URL, DEFAULT_OPTIMIZE_DASHBOARD_URL);
}

export function getAiAnalyticsUrl() {
  return validUrl(process.env.NEXT_PUBLIC_AI_ANALYTICS_URL, DEFAULT_AI_ANALYTICS_URL);
}

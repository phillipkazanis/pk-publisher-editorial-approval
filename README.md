# Publisher Editorial Approval (Stateful Orchestration PoC)

Camunda 8 demo: editorial content approval with AI compliance check, human approval, loop-back revisions, automated publish retry, and a full audit trail.

- Demo brief: `demos/publisher-editorial-approval/brief.md` in phillipkazanis/pk-se-knowledge
- Demo script: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- PoC brief traceability (every brief item, status, gaps): [docs/poc-checklist.md](docs/poc-checklist.md)
- Cluster: cma-showcase-cluster (not yet deployed - deploy gate pending)
- Schema: Supabase `demo_publisher_approval`

## Folder layout

| Path | What it is |
|------|------------|
| `camunda/` | **Web Modeler Git Sync folder.** The current BPMN, DMN and form live here. Edit them in Web Modeler, not by hand. |
| `components/Layout.js`, `pages/_app.js`, `styles/` | Shared header (logo or wordmark) and view nav, plus the stylesheet |
| `pages/index.js` | **Submit** view: just the submission form, with a progress card for the latest submission |
| `pages/revisions.js` | **Revisions** view: a list of articles waiting for a revision; Revise opens an editor and Resubmit continues the same instance |
| `pages/tasks.js`, `pages/api/tasks/` | **Editor tasks** view: open approval tasks with Approve and Reject (calls the Camunda REST API) |
| `pages/admin.js`, `pages/api/admin/submissions.js`, `pages/api/admin/metrics.js`, `lib/metrics.js` | **Admin** view: a KPI strip (first-pass rate, revision rounds, time to publish, retries, abandonment) and a read-only table of submissions, from Supabase |
| `pages/api/limits.js`, `components/WordCount.js` | The word-count limits from the same table the rules read, and a live word count on the Submit and Revisions forms |
| `pages/api/llm-ops/compliance-check.js` | A deterministic stand-in for the AI service in the contract below; can simulate outages |
| `pages/api/submission-status.js` | Read-only: returns a submission's status for the status tracker |
| `pages/api/start-process.js` | Starts a process instance (calls the Camunda cluster) |
| `pages/api/resubmit.js` | Resubmits into the same instance: only while the submission is waiting for a revision, once per round, by publishing the `publisher-approval-resubmitted` message (calls the Camunda cluster) |
| `pages/api/revisions.js` | Read-only: submissions waiting for a revision, with the reason and last text, for the Revisions view |
| `pages/api/mark-abandoned.js` | Called by the process when the revision timer fires, so the app stops accepting resubmissions |
| `pages/api/mock-cms/publish.js` | Mock CMS: fails the first publish attempt per submission, succeeds on the second |
| `pages/api/notify-submitter.js` | Revision notification stub (writes to Supabase) |
| `lib/` | Camunda OAuth client and Supabase REST helper |
| `scripts/smoke-test.mjs` | Local API smoke test |
| `scripts/lint-camunda.mjs` | Lint for the files in `camunda/` |
| `pages/api/brand/logo.js`, `scripts/upload-logo.mjs` | Serves the logo from a private Supabase Storage bucket, and the one-time upload script |
| `docs/ai-compliance-contract.md`, `docs/ai-compliance-check.openapi.yaml` | The AI step as a governed service: the contract the process depends on, and how the agent and an AI service both fit behind it |
| `docs/poc-written-summary.md`, `docs/criteria-crosswalk.md` | Draft written summary for the customer, and a map of the PoC against their 70 assessment criteria |
| `docs/sql/style-rules.sql` | Style guide table and read-only view used by the compliance agent's tool (applied to Supabase; re-runnable) |
| `scripts/camunda-api.mjs`, `docs/samples/` | Starts or resubmits an article straight through the Camunda REST API with an OAuth 2.0 client-credentials token (`npm run api`), and sample article texts for it |
| `scripts/fake-camunda.mjs` | Tiny local stand-in for the few Camunda endpoints the Editor tasks view uses (not a real engine) |

## The AI compliance agent

The AI step in `camunda/publisher_editorial_approval.bpmn` is an **AI Agent sub-process**: an ad-hoc sub-process run by the AI Agent connector (v2, Camunda 8.10 and later), not a single LLM call. It has two read-only tools (banned terms, and style guide rules by topic from Supabase), loops up to 6 model calls, and returns a structured verdict with reasons, warnings, suggested fixes and the rules it checked. The DMN rules still run first. Details, the governance points and the checks to run on the cluster are in [docs/poc-checklist.md](docs/poc-checklist.md). Sample articles for it are in `docs/samples/`: `clean-article.txt` (passes), `revision-article.txt` (fails the DMN rules), `too-long-article.txt` (fails the word-count rule), `ai-check-article.txt` (passes the rules, should fail the agent) and `injection-article.txt` (tries to instruct the AI reviewer).

This is the only element that breaks the "flat process" convention, on purpose, because an AI Agent sub-process has to be an ad-hoc sub-process. The linter allows it only for that connector and checks that the loop is bounded and each tool is documented and has no sequence flows.

## Views

A header nav switches between four views:

- **Submit** (`/`): journalists submit an article. A progress card for the latest submission shows Submitted, In review and Published, with a revision-requested flag that links to Revisions.
- **Revisions** (`/revisions`): articles sent back for a revised version, one row each with the round, a short reason and a Revise button. Revise opens the full reason and an editor with the last saved text; Resubmit continues the same process instance.
- **Editor tasks** (`/tasks`): lists open `Editorial approval` tasks for the `editors` group, with the article, the rules and AI check results, an AI summary, claims that name no source, and plain statistics about the text (read time, sentences, quotations, attribution phrases, figures, headline length, and the word count against the limits; `lib/article-stats.js`). Approve completes the task; Reject needs a reason and sends the article back for revision. The **Viewing as** picker shows the page as the manager (every task; assigns work, does not decide) or as an editor (only tasks assigned to them; approve, reject, or hand one to another editor). It is a view, not a login. **Assign to** and **Reassign to** hand a task to an editor. It uses `POST /v2/user-tasks/search`, `.../{key}/effective-variables/search`, `.../{key}/completion` and `.../{key}/assignment`.
- **Admin** (`/admin`): a KPI strip (first-pass rate, average revision rounds, median time to publish, publish retries, abandonment, calculated from the app's record of each submission) and recent submissions with status, publish attempts, notification count and instance key, refreshed every few seconds. It complements Operate: for step-by-step history, variables and the AI input and output, open the instance in Operate.

Things to know:

- **Native Tasklist is still the main approval UI.** Tasks completed from the Editor tasks view go through the API client, so Camunda's history may show the client, not the editor, as the actor. Use Tasklist when the real user must appear in the audit trail. Reassigning a task to another editor is also done in Tasklist.
- **The API client needs authorizations** to read and complete user tasks and read process instance variables, or the view shows a notice (403). See the Camunda authorization docs.
- **There is no login.** The Editor tasks and Admin pages and their API routes are open to anyone who can reach the app. Keep the deployment behind Vercel SSO and do not expose it publicly.

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` (git-ignored) and fill in the values yourself. Never commit `.env.local` or paste secret values into chat, issues or commits.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are needed by the mock CMS, the notify route and the smoke test.
   - `CAMUNDA_*` values are only needed for `/api/start-process`, `/api/resubmit` and the Editor tasks view (`/api/tasks`). The Submit and Admin views need only Supabase.
   - `MOCK_CMS_BASE_URL` is `http://localhost:3000` locally.
   - Optional branding (public, not secret): `NEXT_PUBLIC_BRAND_NAME` (default "Editorial Console") and `NEXT_PUBLIC_BRAND_LOGO` (default empty, which shows a text wordmark). The logo is never stored in the repo. Recommended: run `npm run upload:logo -- path/to/logo.png` once (it puts the image in a private Supabase Storage bucket, `demo-publisher-brand`) and set `NEXT_PUBLIC_BRAND_LOGO=/api/brand/logo`. The app serves it from there, so it works locally and on Vercel with no image in git. A file in `public/brand/` is git-ignored and works locally only; an absolute https URL also works.
   - `NEXT_PUBLIC_SHOW_TEST_BUTTON=true` shows the "Load test article" buttons. Keep it off on production unless the demo is running.
3. `npm run dev` and open http://localhost:3000. The form page loads without any secrets. `NEXT_PUBLIC_*` values are read at build and dev-server start, so restart after changing them.

## Local tests

With `npm run dev` running in one terminal:

```
npm run smoke
```

This checks that the Submit, Editor tasks and Admin pages load, that the mock publish route fails on the first attempt and succeeds on the second, that a missing `submissionId` is rejected, that the status and admin APIs return the test submission, and that the notify route writes a notification and flags the submission. Safety rules:

- It only writes rows whose `submission_id` starts with `smoke-test-` (titles are marked `[SMOKE TEST]`) and deletes them at the end, even if a check fails. It refuses to touch any other ID.
- It reads values from the environment (via `.env.local`) and reports missing variable names without printing values.
- It does not call `/api/start-process`, `/api/resubmit` or `/api/tasks`, because those hit the Camunda cluster.

To try the Editor tasks view without a cluster, run the fake Camunda in one terminal and the app in another, passing the overrides on the command line so your `.env.local` is untouched:

```
npm run fake:camunda
CAMUNDA_OAUTH_URL=http://localhost:4010/oauth/token CAMUNDA_CLIENT_ID=fake CAMUNDA_CLIENT_SECRET=fake CAMUNDA_ZEEBE_REST_URL=http://localhost:4010 npm run dev
```

Open http://localhost:3000/tasks to see two seeded tasks. `http://localhost:4010/_state` shows which tasks were completed and with which variables. The fake only answers the calls above and rejects requests that do not match Camunda's documented shapes. It does not replace a test against the real cluster.

To start or resubmit through the Camunda REST API with an OAuth 2.0 client-credentials token (no UI or app route involved):

```
npm run api -- start --title "SMOKE TEST - API start" --body-file docs/samples/clean-article.txt
npm run api -- start --title "SMOKE TEST - timeout" --body-file docs/samples/revision-article.txt --revision-timeout PT2M
npm run api -- resubmit <submissionId> --title "SMOKE TEST - API start" --body-file docs/samples/clean-article.txt
```

Add `--writer "Priya Nair"` to start it as a simulated writer. Reassign an approval task with `npm run api -- assign <userTaskKey> --to alice` (Tasklist cannot assign a task to another user; the Editor tasks page has the same control, with the names from `lib/editors.js`).

It needs the `CAMUNDA_*` values and `MOCK_CMS_BASE_URL` in `.env.local`, prints each HTTP step with the bearer token redacted, and never prints the token or secret. `--revision-timeout` (an ISO duration such as `PT2M`) compresses the 24-hour abandon timer for a demo. It starts a **real** process instance on whatever cluster `.env.local` points at; try it against `npm run fake:camunda` first.

**Simulated writers.** The Submit page has a "Writing as" picker with four fictional writers (`lib/writers.js`, reserved `.invalid` addresses). The choice is sent as the process variable `submittedBy` (visible in Operate) and stored on the app's record. Revisions can be filtered by writer, and Editor tasks and Admin show who wrote each article. In production the portal passes the signed-in journalist. Camunda's own history records the API client as the starter, so the writer is business data, not engine identity.

To check the article statistics (pure function): `npm run test:stats`.

To check the metrics calculation (pure function, no database or network):

```
npm run test:metrics
```

To lint the Camunda files (report only, nothing is modified; needs `xmllint`, which is built into macOS):

```
npm run lint:camunda
```

It checks XML and JSON well-formedness, `<zeebe:userTask />` and `candidateGroups` on user tasks, default flows on exclusive gateways, a flat process (no subprocesses or call activities), native message events (no Send Message connector), unique message names with correlation keys, FEEL list comprehensions, unique ids, and cross-references between the BPMN, DMN, form and `start-process.js`.

## Deploy gate

Nothing is deployed to cma-showcase-cluster or Vercel until the live-session check is done. When cleared, deploy in this order: form, DMN, BPMN.

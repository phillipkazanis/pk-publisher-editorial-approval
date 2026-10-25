# Publisher Editorial Approval (Stateful Orchestration PoC)

Camunda 8 demo: editorial content approval with AI compliance check, human approval, loop-back revisions, automated publish retry, and a full audit trail.

- Demo brief: `demos/publisher-editorial-approval/brief.md` in phillipkazanis/pk-se-knowledge
- Demo script: [DEMO_SCRIPT.md](DEMO_SCRIPT.md)
- Cluster: cma-showcase-cluster (not yet deployed - deploy gate pending)
- Schema: Supabase `demo_publisher_approval`

## Folder layout

| Path | What it is |
|------|------------|
| `camunda/` | **Web Modeler Git Sync folder.** The current BPMN, DMN and form live here. Edit them in Web Modeler, not by hand. |
| `pages/index.js` | Submission and resubmission form |
| `pages/api/start-process.js` | Starts a process instance (calls the Camunda cluster) |
| `pages/api/resubmit.js` | Publishes the `publisher-approval-resubmitted` message (calls the Camunda cluster) |
| `pages/api/mock-cms/publish.js` | Mock CMS: fails the first publish attempt per submission, succeeds on the second |
| `pages/api/notify-submitter.js` | Revision notification stub (writes to Supabase) |
| `lib/` | Camunda OAuth client and Supabase REST helper |
| `scripts/smoke-test.mjs` | Local API smoke test |
| `scripts/lint-camunda.mjs` | Lint for the files in `camunda/` |
| `bpmn/`, `dmn/`, `forms/` | **Legacy copies from before the Git Sync restructure. They have drifted from `camunda/` and must not be deployed.** Pending removal. |

## Local setup

1. `npm install`
2. Copy `.env.example` to `.env.local` (git-ignored) and fill in the values yourself. Never commit `.env.local` or paste secret values into chat, issues or commits.
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are needed by the mock CMS, the notify route and the smoke test.
   - `CAMUNDA_*` values are only needed for `/api/start-process` and `/api/resubmit`, which are not used until the deploy gate is cleared.
   - `MOCK_CMS_BASE_URL` is `http://localhost:3000` locally.
3. `npm run dev` and open http://localhost:3000. The form page loads without any secrets.

## Local tests

With `npm run dev` running in one terminal:

```
npm run smoke
```

This checks that the form page loads, that the mock publish route fails on the first attempt and succeeds on the second, that a missing `submissionId` is rejected, and that the notify route writes a notification and flags the submission. Safety rules:

- It only writes rows whose `submission_id` starts with `smoke-test-` (titles are marked `[SMOKE TEST]`) and deletes them at the end, even if a check fails. It refuses to touch any other ID.
- It reads values from the environment (via `.env.local`) and reports missing variable names without printing values.
- It does not call `/api/start-process` or `/api/resubmit`, because those hit the Camunda cluster.

To lint the Camunda files (report only, nothing is modified; needs `xmllint`, which is built into macOS):

```
npm run lint:camunda
```

It checks XML and JSON well-formedness, `<zeebe:userTask />` and `candidateGroups` on user tasks, default flows on exclusive gateways, a flat process (no subprocesses or call activities), native message events (no Send Message connector), unique message names with correlation keys, FEEL list comprehensions, unique ids, and cross-references between the BPMN, DMN, form and `start-process.js`.

## Deploy gate

Nothing is deployed to cma-showcase-cluster or Vercel until the live-session check is done. When cleared, deploy in this order: form, DMN, BPMN.

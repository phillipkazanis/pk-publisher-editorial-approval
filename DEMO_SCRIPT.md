# Demo Script: Publisher Editorial Approval (Stateful Orchestration PoC)

Scenario: a journalist submits a draft article; rules and an AI check run; a human editor approves; the article publishes after a simulated failure and automatic retry. Revisions loop back inside the same process instance. Everything is auditable.

This script follows the four things the PoC brief asks to see: the normal path, the revision path, the resilience test, and the audit trail. Item-by-item coverage and status are in [docs/poc-checklist.md](docs/poc-checklist.md).

**Status.** Only the clean path has run live (4 times, all published with 2 publish attempts). Everything in Parts B to D below has been built but **not yet run on the cluster**. Dry-run each part once before recording. The resilience test (Part C) is **not yet resolved**: do not present an app restart as an engine restart.

## Before you start
- Deploy order: form, then DMN, then parent BPMN (flat, no subprocesses).
- Cluster secrets present: `PUBLISHER_SUPABASE_KEY`, `BEDROCK_API_ACCESS_KEY`, `BEDROCK_API_ACCESS_SECRET`. Confirm the Bedrock region and model in Web Modeler.
- Users for delegation (S5): **two editors** (for example `editor1` and `editor2`), both in candidate group `editors`, plus a **manager** who is allowed to reassign tasks. Give them Tasklist access (`task-worker` role). Use a second browser profile for the second editor.
- `MOCK_CMS_BASE_URL` in the app must be reachable **from the cluster**, not localhost, and not blocked by Vercel SSO (the connectors call `/api/mock-cms/publish` and `/api/notify-submitter`).
- `NEXT_PUBLIC_SHOW_TEST_BUTTON=true` for the "Load test article" buttons. Switch it off afterwards.
- Tabs open: the demo app (Submit, Editor tasks, Admin), Operate, Tasklist, and a terminal in the repo with `.env.local` filled in.

## Opening (1 min)
Editorial workflows span rules, AI, people and downstream systems. Each can pause, fail or change course. The orchestration layer has to keep state through all of it.

## Part A: Normal path (S1, 3 min)
1. **Start by API call secured with OAuth 2.0 client credentials** (brief items 1 and 2). In the terminal:
   `npm run api -- start --title "SMOKE TEST - API start" --body-file docs/samples/clean-article.txt`
   Point out the three steps it prints: the token request (grant type `client_credentials`), the start call with a redacted bearer token, and the instance key. Then show the instance in Operate.
   Alternative: use the Submit view with "Load test article" (the form route uses the same client-credentials token server-side).
2. Walk the flow in Operate: banned-word and threshold lookups (Supabase), DMN rules PASS, AI tone check `VERDICT: PASS`.
3. **Human approval, native Tasklist** (brief item 12: say which approach is used): open Tasklist as an editor, claim and approve. Also show the Editor tasks view as the alternative (article, rules and AI results, Approve/Reject). Note that Tasklist records the real user.
4. Publish fails once (mock HTTP 500). Show the retry with backoff in Operate, then success.
5. Show the Admin view: status Published, 2 publish attempts.
6. Talking point: retry is native to the engine, not custom code.

## Part B: Revision path (S2, S3, timeout; 6 min)
The brief wants a revision triggered by an AI check failure **or** a human rejection, looping within the **same instance**. Show both the rules failure and the rejection.

**S2: rules failure.**
1. Submit "Load revision test article" (contains the banned term "guaranteed"). Note the **process instance key**.
2. The submitter sees "Revision requested" **with the reason** on the Submit view, and the Admin view lists it. In Operate the instance waits at the event-based gateway.
3. Resubmit revised content: the Submit view's resubmit form, or `npm run api -- resubmit <submissionId> --title "..." --body-file docs/samples/clean-article.txt` (a simple API call with revised content).
4. In Operate: the **same instance key** loops back to the banned-word lookup and continues to approval. One instance, one audit trail.

**S3: human rejection.**
1. At the approval step, reject with a reason in Tasklist (type the reason in the form) or in the Editor tasks view (a reason is required there).
2. Show the notification with that reason, the wait state, and resubmission into the same instance.

**Optional timeout to Abandoned** (the brief says include it only if supported).
1. Start with a compressed timeout: `npm run api -- start --title "SMOKE TEST - timeout" --body-file docs/samples/revision-article.txt --revision-timeout PT2M`
2. It fails the rules, then waits. After 2 minutes, show in Operate that the instance ended at the **Abandoned** end event.
3. The Admin view does not change status on abandonment (known gap). Say so if asked.

## Part C: Resilience test (S4, required, 3 min) - DECISION PENDING
The brief requires restarting or interrupting **the orchestration engine/service** during the human approval wait, and showing the paused instance survives and resumes with no data loss, captured as before/after evidence. It calls this one of the most important evaluation points.

Restarting the demo web app is **not** this test. The engine in SaaS is Camunda-managed. Options (see the checklist for detail): run this one test on a self-managed cluster (recommended), ask Camunda about a broker restart on the demo cluster, or state plainly that it was not performed in SaaS.

Whatever route is chosen, capture this evidence before and after the restart: the process instance key, the user task key, the variables on the instance (article title, `complianceResult`, `aiComplianceResult`), the task creation timestamp, and the restart itself (a screen recording or logs).

## S5: Delegation (1 min)
1. Editor 1 claims the pending approval task in Tasklist.
2. As the manager (or via the task's assignee control), reassign it to editor 2, simulating editor 1 being out of office.
3. Editor 2 sees and completes it. This is native and needs no code. If a permission blocks reassignment, say so and describe the admin workaround.

## Part D: Audit trail (S6, 2 min)
1. Open a **completed** instance in Operate. Show every step with its start and end time.
2. Show the decisions as variables: `complianceResult` (DMN), `aiComplianceResult` (AI output), `approvalDecision`, `revisionReason`.
3. Open the AI agent step and show its input (the system and user prompts, which are the element's input mappings) and its output.
4. Show who completed the approval task. **Verify on the cluster that the real user appears**, and say plainly which fields come from the system rather than a person.
5. Optionally open the Admin view for status, publish attempts and the revision reason.

## Close (1 min)
Tie back to the brief's capability table: durable state, pause and resume, loop-back within one instance, retry, human-in-the-loop, AI in the process with audit, and start by API call.

## Anticipated questions
- Can the AI be wrong? Deterministic rules run first and a human decides before publish. The AI output is in the audit trail.
- What if the engine restarts? See Part C. Do not answer from the app restart.
- Can the AI call go through our own LLM gateway? The step currently calls Bedrock through the connector. Whether the connector can target an internal gateway is unverified: check the provider options in Web Modeler before answering.
- Data residency? The cluster is in syd-1 (Sydney). Confirm the Bedrock region is ap-southeast-2 before making this claim.
- Email? The brief allows email. The demo uses a notification stub that writes to Supabase and shows the reason in the app. The email connector can replace it.
- Automated reassignment on timeout? Manager reassignment is shown. Timeout-based reassignment is a possible extension.

## Deviations for the written summary
See the list at the end of [docs/poc-checklist.md](docs/poc-checklist.md): notification stub rather than email, Bedrock rather than an LLM Ops API, native Tasklist primary with a custom view as an alternative, OAuth at the Camunda API but not on the web form's own route, and the engine-restart question.

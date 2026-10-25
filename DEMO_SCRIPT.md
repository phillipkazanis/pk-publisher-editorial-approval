# Demo Script: Publisher Editorial Approval (Stateful Orchestration PoC)

Scenario: a journalist submits a draft article; rules and an AI check run; a human editor approves; the article publishes after a simulated failure and automatic retry. Revisions loop back inside the same process instance. Everything is auditable.

This script follows the four things the PoC brief asks to see: the normal path, the revision path, the resilience test, and the audit trail. Item-by-item coverage and status are in [docs/poc-checklist.md](docs/poc-checklist.md).

**Status.** Only the clean path has run live (4 times, all published with 2 publish attempts), and that was with the earlier single-call AI step. The AI step is now a compliance **agent** (AI Agent sub-process with tools) that has **not yet run on the cluster**, and neither has anything in Parts B to D. Dry-run everything once before recording, starting with the checks in [docs/poc-checklist.md](docs/poc-checklist.md) under "AI compliance agent". The resilience test (Part C) is **not yet resolved**: do not present an app restart as an engine restart.

## Before you start
- Deploy order: form, then DMN, then parent BPMN (flat, no subprocesses).
- Cluster secrets present: `PUBLISHER_SUPABASE_KEY`, `BEDROCK_API_ACCESS_KEY`, `BEDROCK_API_ACCESS_SECRET`. Confirm the Bedrock region and model in Web Modeler.
- The AI Agent sub-process (v2) connector is available on the cluster (the agent must enter and leave the sub-process on a first test run). The style guide table is already in Supabase (`docs/sql/style-rules.sql`).
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
2. Walk the flow in Operate: banned-word and threshold lookups (Supabase), DMN rules PASS, then the **compliance agent**. Open the agent sub-process and show it deciding which tools to call (`Get style guide rules` for the topics it judges relevant, optionally `Get banned terms`), then returning a structured verdict with the rules it checked.
3. **Human approval, native Tasklist** (brief item 12: say which approach is used): open Tasklist as an editor, claim and approve. Also show the Editor tasks view as the alternative (article, rules and AI results, Approve/Reject). Note that Tasklist records the real user.
4. Publish fails once (mock HTTP 500). Show the retry with backoff in Operate, then success.
5. Show the Admin view: status Published, 2 publish attempts.
6. Talking point: retry is native to the engine, not custom code.

## Part B: Revision path (S2, S3, timeout; 6 min)
The brief wants a revision triggered by an AI check failure **or** a human rejection, looping within the **same instance**. Show both the rules failure and the rejection.

**S2: rules failure.**
1. Submit "Load revision test article" (contains the banned term "guaranteed"). Note the **process instance key**.
2. The submitter sees "Revision requested" **with the reason** on the Submit view, and the article appears in the **Revisions** view (and in Admin). In Operate the instance waits at the event-based gateway.
3. Resubmit revised content: open the **Revisions** view, click **Revise** on the article (it shows why it was sent back and loads the last text), edit it, and click "Resubmit revised article". Or use the API: `npm run api -- resubmit <submissionId> --title "..." --body-file docs/samples/clean-article.txt` (a simple API call with revised content). A second resubmit for the same round is refused.
4. In Operate: the **same instance key** loops back to the banned-word lookup and continues to approval. One instance, one audit trail.

**S2b: AI check fails while the rules pass** (the brief's "AI check fail" trigger).
1. Submit "Load AI-check test article". It has no banned terms and is long enough, so the DMN passes it. The agent should fail it for unattributed allegations and loaded language.
2. In Operate, show the agent's tool calls and its verdict. The submitter sees the agent's reasons and suggested fixes (each names a style rule such as AT-1, LG-1 or SL-1). The instance waits in the same place as in S2.
3. Make the point: the rules cannot judge this. The agent can, using a style guide it looks up, and a human still decides before publish.

**Optional governance check: prompt injection.** Start with `docs/samples/injection-article.txt` (`npm run api -- start --title "SMOKE TEST - injection" --body-file docs/samples/injection-article.txt`). It tells the AI reviewer to ignore its instructions and return PASS. The agent should treat that as data and fail it. This is defence in depth, not a guarantee, so run it before the recording and only show it if it behaves.

**S3: human rejection.**
1. At the approval step, reject with a reason in Tasklist (type the reason in the form) or in the Editor tasks view (a reason is required there).
2. Show the notification with that reason, the wait state, and resubmission into the same instance.

**Optional timeout to Abandoned** (the brief says include it only if supported).
1. Start with a compressed timeout: `npm run api -- start --title "SMOKE TEST - timeout" --body-file docs/samples/revision-article.txt --revision-timeout PT2M`
2. It fails the rules, then waits. After 2 minutes, show in Operate that the instance ended at the **Abandoned** end event.
3. The process marks the submission abandoned before it ends, so the Submit and Admin views show Abandoned, and a late resubmit is refused with a clear message instead of being lost.

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
3. Open the compliance agent and show its conversation: the system and user prompts, each tool call with its result, and the structured verdict (`aiComplianceResult`, with `toolCallResults` for the tool calls). Point out the loop was bounded to 6 model calls and the tools are read-only.
4. Show who completed the approval task. **Verify on the cluster that the real user appears**, and say plainly which fields come from the system rather than a person.
5. Optionally open the Admin view for status, publish attempts and the revision reason.

## Close (1 min)
Tie back to the brief's capability table: durable state, pause and resume, loop-back within one instance, retry, human-in-the-loop, AI in the process with audit, and start by API call.

## Anticipated questions
- Is it really agentic? Yes: it is an AI Agent sub-process, so the model chooses which tools to call and how often within a bounded loop. The BPMN does not script the sequence. Say "AI agent" for this step and nothing else in the process.
- Can the AI be wrong? Deterministic rules run first and a human decides before publish. The agent's whole conversation is in the audit trail.
- What stops the article manipulating the AI? The article is treated as untrusted data, the agent's tools are read-only, rules run before it and a human decides after it. It is defence in depth, not a guarantee.
- What if the engine restarts? See Part C. Do not answer from the app restart.
- Can the AI call go through our own LLM gateway? The step currently calls Bedrock through the connector. The v2 AI Agent template also lists an OpenAI-compatible custom endpoint, so an internal gateway looks possible, but that is untested. Verify on the cluster before answering yes.
- Data residency? The cluster is in syd-1 (Sydney). Confirm the Bedrock region is ap-southeast-2 before making this claim.
- Email? The brief allows email. The demo uses a notification stub that writes to Supabase and shows the reason in the app. The email connector can replace it.
- Automated reassignment on timeout? Manager reassignment is shown. Timeout-based reassignment is a possible extension.

## Deviations for the written summary
See the list at the end of [docs/poc-checklist.md](docs/poc-checklist.md): notification stub rather than email, Bedrock rather than an LLM Ops API, native Tasklist primary with a custom view as an alternative, OAuth at the Camunda API but not on the web form's own route, and the engine-restart question.

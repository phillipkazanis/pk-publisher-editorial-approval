# PoC brief traceability

Every item in the PoC brief, where this demo addresses it, and how sure we are. Written from a line-by-line re-read of the brief.

**Status key**
- **Verified live**: has run end to end on the real cluster (evidence below).
- **Built, not run live**: implemented and tested locally (including against a fake Camunda), but never executed on the cluster. Dry-run before recording.
- **Partial**: addressed with a deviation that must be stated in the written summary.
- **Gap**: not addressed yet.

**What has actually run live** (from the Supabase audit mirror, 25 Oct): 4 submissions, all on the clean path and all published, with 2 publish attempts each. That proves: start, Supabase lookups, DMN rules (pass), AI check (pass), a human approval, the failing-then-succeeding publish, and completion. **Nothing else has run live**: no rules failure, no AI failure, no human rejection, no notification, no resubmission, no timeout.

## Scenario steps

| # | Brief requirement | How the demo addresses it | Status |
|---|---|---|---|
| 1 | Content submitted via a simple API call or form; plain text/JSON payload; no real CMS | Submit view (form) posts JSON to the app, which starts the process. `npm run api -- start` starts it directly through Camunda's REST API. | Form: verified live. API script: built, not run live |
| 2 | Submission secured through the OAuth 2.0 client-credentials grant | The app server and `npm run api` both obtain a client-credentials token before calling Camunda. The browser-to-app route is not itself OAuth-protected. Show the script (token request, then start with a redacted bearer token) as the evidence. | Partial |
| 3 | Automated compliance check as an AI/LLM step | AI Agent Task (Bedrock, single turn, tone and wording) after the DMN rules. | Verified live (pass) |
| 4 | Basic rules: word count, banned words, missing headline | DMN `publisherComplianceRules`: max and min word count and banned terms from Supabase tables, plus headline present. | Pass verified live. Fail branches not run live |
| 5 | LLM simulated via a simple API call (the customer's LLM Ops team exposes AI through APIs) | The agent calls Bedrock through the connector, not an LLM Ops style API. Whether the AI Agent connector can point at an internal gateway is **unverified** (check the provider options in Web Modeler before claiming it). | Partial |
| 6 | Check fails: route to Revision Required | Rules fail or AI fail go to "Notify submitter" then the wait state. | Built, not run live |
| 7 | Check passes: continue to approval | Gateways to the editorial approval user task. | Verified live |
| 8 | Revision Required: notify the submitter **with the reason** (email is fine) | HTTP stub writes a `notifications` row. The reason is now shown to the submitter on the Submit view and on the Admin view. Not real email (brief allows email; this is a stub). | Built, not run live. Partial (not email) |
| 9 | Same process instance returns to a waiting-for-resubmission state, not a new submission | Event-based gateway waits for the `publisher-approval-resubmitted` message (correlation key `submissionId`). Prove it by showing the **same process instance key** before and after in Operate. | Built, not run live |
| 10 | Resubmission via a simple API call with revised content routes back to step 2 | `/api/resubmit`, the Submit view, or `npm run api -- resubmit <id>`. Loops to the banned-word lookup. | Built, not run live |
| 11 | Optional: no resubmission within a defined time marks the instance Abandoned (24 h, simulated for demo) | Timer on the event-based gateway (default `PT24H`, overridable with the `revisionTimeout` variable). Compress with `npm run api -- start ... --revision-timeout PT2M`. Operate shows the instance ending at the "Abandoned" end event. The Admin view does not change status on abandonment. | Built, not run live. Partial (Admin) |
| 12 | Human approval via a task interface; **note which approach is used** | Native Tasklist is primary. The custom Editor tasks view is an alternative. The written summary must say both. | Approval verified live |
| 13 | Pause from minutes to (simulated) days; state survives | The user task has no timer or timeout. The Editor tasks view shows "waiting since". Demonstrated for real by the resilience test. | Built, not run live |
| 14 | Approver delegation: reassign a pending task to another user | Native in Tasklist (assign to another user). Needs two users in group `editors` and someone allowed to reassign. | Built, prerequisites unconfirmed |
| 15 | Rejection routes back to Revision Required | Gateway "Approved?" default flow to "Notify submitter". The native form does **not** force a reason on reject (see BPMN changes below). The custom view does. | Built, not run live |
| 16 | Approval proceeds to publish | Gateway to the publish task. | Verified live |
| 17 | Mock publish fails first attempt (HTTP 500); automatic retry/backoff; succeeds later | Mock CMS fails attempt 1 per submission. Task has 3 retries and a 10 s backoff. | Verified live (2 attempts x 4) |
| 18 | Process complete | End event "Published". | Verified live |
| 19 | Full audit trail: every step, decision, timestamp, actor, **including the AI agent's input and output** | Operate shows steps and timestamps. Decisions are variables (`complianceResult`, `aiComplianceResult`, `approvalDecision`, `revisionReason`). The agent's prompts are element input mappings and its output is `aiComplianceResult`. **To verify live:** that the prompts show in Operate, and that the user-task completion shows the real user as actor. The Admin view shows status only, not the trail. | Partial, to verify |

## Required resilience test

| # | Brief requirement | How the demo addresses it | Status |
|---|---|---|---|
| 20 | During the human approval wait, restart or interrupt the orchestration engine/service; show the paused instance survives and resumes with no data loss; capture before/after (recording or logs). "One of our most important evaluation points." | **Not met by the current script.** The script restarts the Next.js app, which is not the orchestration engine, and proves nothing about engine durability. In SaaS the engine is Camunda-managed, and I know of no self-serve engine restart (not verified; confirm with Camunda). | **Gap** |

Options to close the gap (a decision is needed):
- **A. Self-managed cluster for this one test (recommended).** Run the same BPMN, DMN and form on a self-managed Camunda 8 cluster (Docker Compose or Helm), leave an article waiting at approval, stop and start the engine, and show the instance, task and variables before and after. This literally meets the brief and answers the "deployment model" question in the written summary. Needs the connectors runtime, the secrets and a reachable mock CMS. Image tags and persistence settings are **unverified**: check the Camunda docs for the 8.10 install path first. Camunda 8 Run (the single-binary local option) uses H2 by default and is documented as not for production; whether it keeps instances across a restart is unverified.
- **B. SaaS plus Camunda's help.** Ask Camunda engineering or support whether a broker restart can be arranged on the demo cluster. Not self-serve, and timing is not in our control.
- **C. SaaS only, stated plainly.** Show the instance held in the cluster while the app restarts, and say in the summary that the engine restart was not performed in SaaS and why. This risks being read as a failed required test.

## Capability areas (brief table)

| Capability | Where it is shown | Status |
|---|---|---|
| Durable state persistence | Resilience test (item 20) | Gap |
| Long-running / pause-resume | Human approval wait (items 12, 13) | Built, not run live |
| Loop-back / re-entry within a single instance | Revision loop (items 9, 10); same instance key in Operate | Built, not run live |
| Error handling and retry | Publish fails once, retries with backoff (item 17) | Verified live |
| Human-in-the-loop | Native Tasklist, plus the Editor tasks view (item 12) | Verified live (approval) |
| Agents (AI/LLM) | AI Agent Task in the process (item 3) | Verified live (pass) |
| Audit trail | Operate instance history and variables (item 19) | Partial, to verify |
| Event/API trigger | Form, `npm run api -- start` (items 1, 2) | Form verified live. Script not run live |

## Deliverables

| Deliverable | Status |
|---|---|
| Visual demo or recorded video: normal path, revision path (AI fail **or** human rejection), resilience test, audit trail of a completed instance | Normal path ready. Revision path, resilience and audit trail not yet run live. See `DEMO_SCRIPT.md` |
| Process definition files (BPMN, DMN, form) | In `camunda/` (Web Modeler sync folder) |
| Written summary (1 to 2 pages): architecture and hosting; deviations and why; capabilities not demonstrated and why | **Not written.** Draft after the resilience decision, since the architecture section depends on it |
| Live instance access, "if convenient" | The Vercel URL is behind Vercel SSO and the cluster needs Camunda logins, so an evaluator cannot click through yet. Decide whether to invite them or provide a bypass |

Due: **30 October 2026** (end of week 5).

## Deviations to state in the written summary
- Notifications are an HTTP stub that writes to Supabase, not email.
- The AI step runs on Bedrock via the connector, not a customer LLM Ops API. Deterministic rules run in DMN first, and the AI check covers tone and wording.
- Human approval is native Tasklist, with a custom Editor tasks view as an alternative. Tasks completed from the custom view go through the API client, so Camunda's history may show the client, not the person, as actor.
- Submission is secured by OAuth 2.0 client credentials at the Camunda API. The demo web form's own route is not OAuth-protected.
- Engine restart: see item 20.

## BPMN and form changes recommended (make them in Web Modeler, not by hand)
These were found by reading the BPMN against the brief. None has been applied.
1. **Revision reason can be wrong or stale.** The notify task uses the DMN reason on a rules failure, otherwise `revisionReason` (a previous editor's text, if any), otherwise a generic message. After an AI failure it never uses the AI's own explanation, and after an earlier human rejection it can show the old reason. Suggested expression for the `reason` field:
   `if complianceResult.verdict = "FAIL" then complianceResult.reason else if not(contains(upper case(aiComplianceResult.responseText), "VERDICT: PASS")) then aiComplianceResult.responseText else revisionReason`
   Test all three revision paths after changing it.
2. **Approval form: require a reason when rejecting.** Today an editor can reject with no reason, and the submitter then gets the generic AI message.
3. **Optional: record abandonment.** Add a task before the "Abandoned" end event that marks the submission abandoned in Supabase, so the Admin view shows it.

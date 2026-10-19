# Demo Script: Publisher Editorial Approval (Stateful Orchestration PoC)

Scenario: a journalist submits a draft article; rules and an AI check run; a human editor approves; the article publishes with a simulated failure and automatic retry. Revisions loop back inside the same instance. Everything is auditable.

Status: BPMN, DMN and forms are authored and in this repo. NOT yet deployed. Frontend, mock endpoints and deployment are pending the deploy gate.

## Before you start
- Deploy order: form -> DMN -> parent BPMN (no subprocesses, flat by design)
- Confirm connector secrets on cma-showcase-cluster: `PUBLISHER_SUPABASE_KEY`, `BEDROCK_API_ACCESS_KEY`, `BEDROCK_API_ACCESS_SECRET` (names and Bedrock region/model still unverified)
- Confirm candidate group `editors` exists and the demo editor user is a member, with `task-worker` role granted
- Have Operate, Tasklist and the demo frontend open in tabs

## Opening (1 min)
Problem: editorial workflows span rules, AI, people and downstream systems. Each of those can pause, fail or change course. The orchestration layer has to keep state through all of it.

## S1: Normal path with publish retry (3 min)
1. Submit a clean article via the API (OAuth client credentials). Show the start in Operate.
2. Walk the flow: banned-word and threshold lookups from Supabase, DMN rules (PASS), AI tone check (VERDICT: PASS).
3. Open Tasklist: the editor task is visible to the `editors` group. Approve it.
4. Publish call fails once (mock HTTP 500). Show the job retry with backoff in Operate, then success.
5. Talking point: the retry is native to the engine, not custom code in our app.

## S2: Revision loop in the same instance (3 min)
1. Submit an article containing a banned term (e.g. "guaranteed"). DMN fails it.
2. Show the revision notification and the process waiting at the event-based gateway.
3. Send the resubmission (message `publisher-approval-resubmitted`, correlation key `submissionId`).
4. Show the same process instance ID loop back to the banned-word lookup. Only one instance, one audit trail.

## S3: Human rejection routes back (2 min)
1. In Tasklist, reject with a revision reason.
2. Show routing to the revision notification and the wait state, same instance.

## S4: Resilience test (3 min, required by the PoC brief)
1. Leave an article waiting in the editor task.
2. Restart the job-worker service (or stop and start the app's worker process).
3. Show the instance in Operate still in the human task, unchanged.
4. Complete the task. The process resumes with no data loss.
5. Be explicit: in SaaS, the Zeebe engine is Camunda-managed. We demonstrate durability by restarting our side and showing the state held in the cluster.

## S5: Delegation (1 min)
1. Reassign a pending editor task to another editor in Tasklist. Show it is native and requires no code.

## S6: Audit trail (2 min)
1. Open a completed instance in Operate. Show every step, timestamp and actor, including the AI agent input and output.

## Close (1 min)
Tie back to the PoC criteria: durable state, pause/resume, loop-back within one instance, retry, human-in-the-loop, AI in process with audit, API trigger.

## Anticipated questions
- Can the AI be wrong? Deterministic rules run first, and a human decides before publish. The AI output is in the audit trail.
- What if the engine restarts? See S4.
- Automated reassignment on timeout? Manager reassignment is shown. Timeout-based reassignment is a possible extension.
- Data residency? Cluster is syd-1 (Sydney). The Bedrock region must be confirmed in ap-southeast-2 before making this claim.
- Email? The brief allows email. The demo uses a notification API stub; swap in the email connector for production.

## Known deviations and gaps (for the PoC written summary)
- Notification is an HTTP stub, not SMTP email.
- Approval uses native Tasklist, not a custom UI.
- AI Agent Task template version 12 and Bedrock region/model must be verified in Web Modeler before deploy.
- Revision reason may carry over stale across loops (PoC simplification).
- Engine restart is demonstrated via worker restart, not an engine restart (SaaS).

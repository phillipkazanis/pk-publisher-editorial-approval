# PoC brief traceability

Every item in the PoC brief, where this demo addresses it, and how sure we are. Written from a line-by-line re-read of the brief.

**Status key**
- **Verified live**: has run end to end on the real cluster (evidence below).
- **Built, not run live**: implemented and tested locally (including against a fake Camunda), but never executed on the cluster. Dry-run before recording.
- **Partial**: addressed with a deviation that must be stated in the written summary.
- **Gap**: not addressed yet.

**What has actually run on the cluster** (read from Operate and the Supabase record, 25 Oct)
- **Version 3, single-call AI step:** 4 clean articles, each approved by an editor (two in Tasklist, with the user recorded as assignee) and published after 2 publish attempts.
- **Version 5 and 6, with the compliance agent:**
  - The agent ran: tool calls, structured verdict, the rule keys it checked. It failed the AI-check article with reasons and fixes and passed a clean article.
  - A banned-term article failed the rules and went to revision.
  - Revision requests with the agent's reasons reached the submitter's record, and the instance waited in the same place.
  - Version 5 had a defect where resubmitted text was ignored. It was fixed in version 6.
- **Proof on version 6** (instance `6755399441190489`, completed, no incident): the AI-check article failed the agent, revision round 1, resubmitted with the clean article, the process-level `articleBody` became the new text, the agent started a **fresh conversation** and passed it, an editor task was completed 16 seconds after creation, the publish retried (2 attempts) and the instance completed. That one instance shows loop-back, the fix, a fresh agent round, approval and retry in a single history.
- **Not yet run:** the timeout to Abandoned, delegation, the API start script, a word-count failure, a missing-headline failure, a human rejection routing back, native Tasklist approval with the agent version, and the engine restart (the presenter owns that one).

**One thing the live data shows about identity.** The version 6 approval task has **no assignee**, which is how a task completed straight through the API looks, so it was most likely completed from the custom Editor tasks page. That also confirms the page works against the real cluster. Approvals made in Tasklist record the person. The history would not show who approved the API-completed one.

## What the customer said on the clarification call
From the call transcript. It is an automatic transcription and unclear in places, so confirm anything important in writing.
- **The demo is live** with the whole evaluation team, who record it themselves. The directors above them see the recording, so what is shown must make sense without the room.
- **Priorities:** statefulness and human-in-the-loop first (functional), then AI and developer experience, then commercials.
- **Everything can be synthetic.** Any article length, mock APIs, mock CMS. The intent is to focus on product capability, not to make the PoC heavy.
- **Delegation:** a manager reassigning a task (by API, because Tasklist cannot assign to another user) is enough for the demo. Pick one method to show. The written criteria should mention the other options (automated reassignment, escalation).
- **Pause and resume of the cluster:** a recording appeared acceptable instead of doing it live. **Confirm in writing.**
- **Timing:** they are targeting the end of October. Time slots for the live session are to be proposed.
- **Procurement:** they lean towards buying direct, and how easy vendor onboarding is counts. Implementation partners are separate and they have their own.

## Scenario steps

| # | Brief requirement | How the demo addresses it | Status |
|---|---|---|---|
| 1 | Content submitted via a simple API call or form; plain text/JSON payload; no real CMS | Submit view (form) posts JSON to the app, which starts the process. `npm run api -- start` starts it directly through Camunda's REST API. | Form: verified live. API script: built, not run live |
| 2 | Submission secured through the OAuth 2.0 client-credentials grant | The app server and `npm run api` both obtain a client-credentials token before calling Camunda. The browser-to-app route is not itself OAuth-protected. Show the script (token request, then start with a redacted bearer token) as the evidence. | Partial |
| 3 | Automated compliance check as an AI/LLM step | AI Agent **sub-process** (ad-hoc, AI Agent connector v2) after the DMN rules: the model chooses between two read-only tools (banned terms, style guide by topic) in a loop bounded to 6 model calls, and returns a structured verdict. | Verified live (version 6) |
| 4 | Basic rules: word count, banned words, missing headline. The brief's wording: "flags if the article **exceeds** a word count, contains a banned word list, or is missing a required field such as a headline" | DMN `publisherComplianceRules`: **maximum word count** (1,200, from the Supabase `compliance_thresholds` table), banned terms (Supabase list, case-insensitive) and headline present. Each has a way to demonstrate it: "Load revision test article" (banned term), "Load too-long test article" (1,358 words, over the maximum), and clearing the headline before submitting. **Not in the brief:** the DMN has a minimum-word-count rule. It is switched off (`min_word_count` = 0 in `compliance_thresholds`) because the customer said on the clarification call that article length does not matter. Reasons are actionable: the word-count reason states the article's length and the limit, and the banned-term reason names the terms found. The form shows a live word count against the limit while writing. The DMN uses hit policy FIRST, so only the first failing rule is reported. | Pass verified live. Banned-term failure verified live. Word-count and headline failures not run live |
| 5 | LLM simulated via a simple API call (the customer's LLM Ops team exposes AI through APIs) | The agent calls Bedrock through the connector, not an LLM Ops style API. The v2 AI Agent template lists an OpenAI-compatible custom endpoint and a `custom` provider type, so pointing it at an internal gateway looks possible. That comes from the template file, not from a test: verify on the cluster before claiming it. | Partial |
| 6 | Check fails: route to Revision Required | Rules fail or AI fail go to "Notify submitter" then the wait state. | Verified live (rules failure and AI failure) |
| 7 | Check passes: continue to approval | Gateways to the editorial approval user task. | Verified live |
| 8 | Revision Required: notify the submitter **with the reason** (email is fine) | HTTP stub writes a `notifications` row. The reason is shown to the submitter on the Submit view and in the Revisions list, and on the Admin view. Not real email (brief allows email; this is a stub). | Verified live (reasons and fixes reach the submitter). Partial (not email) |
| 9 | Same process instance returns to a waiting-for-resubmission state, not a new submission | Event-based gateway waits for the `publisher-approval-resubmitted` message (correlation key `submissionId`). Prove it by showing the **same process instance key** before and after in Operate. See "Resubmission management" below. | Verified live |
| 10 | Resubmission via a simple API call with revised content routes back to step 2 | `/api/resubmit`, the Revisions view, or `npm run api -- resubmit <id>`. Loops to the banned-word lookup. Only allowed while the submission is waiting for a revision, and only once per round. | Verified live on version 6 (the new text is honoured) |
| 11 | Optional: no resubmission within a defined time marks the instance Abandoned (24 h, simulated for demo) | Timer on the event-based gateway (default `PT24H`, overridable with the `revisionTimeout` variable). Compress with `npm run api -- start ... --revision-timeout PT2M`. The instance marks the submission abandoned in Supabase, then ends at the "Abandoned" end event. The app then shows Abandoned and refuses a late resubmission. | Built, not run live |
| 12 | Human approval via a task interface; **note which approach is used** | Native Tasklist is primary. The custom Editor tasks view is an alternative. The written summary must say both. | Verified live (Tasklist earlier; custom page on version 6) |
| 13 | Pause from minutes to (simulated) days; state survives | The user task has no timer or timeout. The Editor tasks view shows "waiting since". Demonstrated for real by the resilience test. | Built, not run live |
| 14 | Approver delegation: reassign a pending task to another user | Tasklist can claim and release but a normal user cannot assign a task to someone else (observed). So reassignment is by API: the Editor tasks page has a per-person view (manager assigns; each editor sees only their own tasks and can hand one on), or use `npm run api -- assign`. Needs two real users in group `editors` and an API client allowed to update user tasks. | Built and tested against the local fake only; **not run on the cluster** |
| 15 | Rejection routes back to Revision Required | Gateway "Approved?" default flow to "Notify submitter". The native form does **not** force a reason on reject (see BPMN changes below). The custom view does. | Built, not run live |
| 16 | Approval proceeds to publish | Gateway to the publish task. | Verified live |
| 17 | Mock publish fails first attempt (HTTP 500); automatic retry/backoff; succeeds later | Mock CMS fails attempt 1 per submission. Task has 3 retries and a 10 s backoff. | Verified live |
| 18 | Process complete | End event "Published". | Verified live |
| 19 | Full audit trail: every step, decision, timestamp, actor, **including the AI agent's input and output** | Operate shows steps and timestamps. Decisions are variables (`complianceResult`, `aiComplianceResult`, `approvalDecision`, `revisionReason`). The agent's whole conversation (prompts, tool calls, tool results, structured verdict) is kept in `aiComplianceResult.context` and `toolCallResults`. **To verify live:** that the conversation and tool calls are readable in Operate, and that the user-task completion shows the real user as actor. The Admin view shows status only, not the trail. | Partial. Agent conversation, tool calls and verdict visible in Operate. Actor recorded for Tasklist approvals, empty for API-completed ones |

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
| Long-running / pause-resume | Human approval wait (items 12, 13) | Verified live for minutes. Days is by design, not run |
| Loop-back / re-entry within a single instance | Revision loop (items 9, 10); same instance key in Operate | Verified live |
| Error handling and retry | Publish fails once, retries with backoff (item 17) | Verified live |
| Human-in-the-loop | Native Tasklist, plus the Editor tasks view (item 12) | Verified live |
| Agents (AI/LLM) | AI Agent sub-process with tools in the process (item 3); the model decides which tools to call | Verified live |
| Audit trail | Operate instance history and variables (item 19) | Partial (see the identity note above) |
| Event/API trigger | Form, `npm run api -- start` (items 1, 2) | Form verified live. Script not run live |

## Resubmission management

**Model.** One process instance per article. A revision is a *message* correlated by `submissionId` to that instance's waiting state (the event-based gateway), never a new instance. The alternative, a task for the submitter in Tasklist, was not chosen because the brief asks for resubmission by a simple API call.

**Rules the demo enforces**
1. **Only a submission that is waiting for a revision can be resubmitted.** Unknown ids get 404. A submission that is still being checked, already resubmitted, published or abandoned gets 409 with a plain explanation. Before this, a resubmit at the wrong time was silently buffered or lost.
2. **Exactly once per revision round.** The status is claimed atomically before the message is published, and the message carries `messageId = <submissionId>:r<round>`, so a double click or a retry cannot start a second loop. If Camunda cannot be reached, the claim is put back so the submitter can try again.
3. **Time to live is an integer in milliseconds** (5 minutes). The earlier code sent an ISO string (`PT1H`), which the API most likely rejects, so no resubmission would have worked. The fake Camunda now rejects that mistake too.
4. **Every loop starts clean, and carries the new text.** On resubmission the catch event clears the previous round's agent result and conversation, rules result, approval decision, revision reason and notification result, and increments `revisionRound`. It also maps the resubmitted `articleBody`, `articleTitle` and `wordCount` into the process explicitly. **This matters:** once an output mapping exists on the event, Camunda discards every message variable that is not mapped ("if there is no mapping for a job/message variable, the variable is not merged"). The first version of the clean-up mapped only the clean-up variables, so the revised text never reached the process and every round re-checked the original article. The linter now fails any message event that has output mappings but does not map the payload the resubmit route sends. The agent also starts each round with an empty conversation, so it cannot continue the previous article's chat.
5. **Timeout ends cleanly.** After the timer fires the process marks the submission abandoned in Supabase, then ends at "Abandoned". The app shows Abandoned and refuses a late resubmission instead of reporting success for a message nothing would receive.

**Submitter experience.** Submitting and revising are separate. The Submit view is only the submission form plus a progress card for the latest submission. The Revisions view is a clean list of articles waiting for a revision, each with its round, a one-line reason and a Revise button. Revise opens the full reason (the agent's findings and suggested fixes) and an editor with the last saved text, and Resubmit continues the same instance. Article text is stored with the submission for this.

**Verified on the cluster (version 6):** resubmitting with different text loops the same instance back, the process-level `articleBody` becomes the new text, the agent's second conversation holds only the new article, `revisionRound` counts the round, and the previous round's results are cleared.

**Still to run:** the timeout (start with `--revision-timeout PT2M`, wait, and confirm the instance ends at Abandoned, the app shows Abandoned and a resubmit is refused), and a double click on "Resubmit revised article" producing one loop and not two.

**Instances already running keep the process version they started on.** Anything started before a BPMN version is deployed keeps that version's behaviour. Version 5 has the dropped-payload bug above, so a version 5 instance accepts a resubmission but keeps re-checking its original text. Start new instances after deploying the fix, or migrate waiting version 5 instances to the fixed version in Operate before resubmitting.

## AI compliance agent

The AI step is an **AI Agent sub-process** (`bpmn:adHocSubProcess` run by the AI Agent connector v2, template `io.camunda.connectors.agenticai.ai-agent-subprocess.v2` version 1, for Camunda 8.10 and later). The model, not the BPMN, decides which tools to call and how many times.

- **Tools** (read-only, plain elements inside the sub-process with no sequence flows, each described by its documentation text): `Get banned terms` and `Get style guide rules` (one call per topic: headline, attribution, health, sensational, legal, tone). The style guide lives in the Supabase table `style_rules` (`docs/sql/style-rules.sql`).
- **Output**: a structured JSON verdict (`verdict`, `reasons`, `warnings`, `suggestedFixes`, `rulesChecked`) in `aiComplianceResult.responseJson`. A `FAIL` routes to Revision Required, and the reasons and fixes go to the submitter.
- **What it adds over the DMN rules**: judgment the rules cannot make, such as unattributed allegations or loaded language, using the style guide it looks up. The DMN stays as the deterministic first gate.

Governance points to say out loud:
- Deterministic rules run first, a human decides last, and the agent sits between them.
- The loop is bounded (`maxModelCalls` = 6) and the tools are read-only.
- The article is treated as untrusted data. The prompt wraps it in markers and tells the model to fail any article that tries to instruct it. The injection sample (`docs/samples/injection-article.txt`) tests this. This is defence in depth, not a guarantee.
- The full conversation is kept with the instance for audit, and the structured verdict names the rules the agent actually checked.
- Temperature is 0 and output length is capped.

**Verified on the cluster:** the version 2 connector is available; the Bedrock model, region and secrets work; the agent calls its tools and returns a structured verdict; the clean article passes and the AI-check article fails with reasons that cite style rules; the submitter sees the reasons and suggested fixes; a resubmission loops in the same instance; the clean path publishes.

**Still to run:** the prompt-injection sample (`docs/samples/injection-article.txt`) should fail; run it before the session and only show it if it behaves.

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
- The AI step is an AI Agent sub-process on Bedrock via the connector, not a customer LLM Ops API. Deterministic rules run in DMN first. The agent judges tone, wording and presentation against a style guide using tools, and does not fact-check. The process is flat except for this one ad-hoc sub-process, which is intentional.
- Human approval is native Tasklist, with a custom Editor tasks view as an alternative. Tasks completed from the custom view go through the API client, so Camunda's history may show the client, not the person, as actor.
- Submission is secured by OAuth 2.0 client credentials at the Camunda API. The demo web form's own route is not OAuth-protected.
- Engine restart: see item 20.

## BPMN and form changes recommended (make them in Web Modeler, not by hand)
These were found by reading the BPMN against the brief. None has been applied.
1. **Revision reason (applied, needs a live test).** The notify task now uses the DMN reason on a rules failure, otherwise the agent's reasons and suggested fixes, otherwise the editor's reason. This fixes the earlier generic and stale-reason problem. Test all three revision paths on the cluster.
2. **Approval form: require a reason when rejecting.** Today an editor can reject with no reason, and the submitter then gets the generic AI message.
3. **Optional: record abandonment.** Add a task before the "Abandoned" end event that marks the submission abandoned in Supabase, so the Admin view shows it.

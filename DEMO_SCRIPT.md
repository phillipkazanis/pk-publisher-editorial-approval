# Demo Script: Publisher Editorial Approval (Stateful Orchestration PoC)

## What this session is
A **live demo for the evaluation team**, who will record it and share the recording with the directors above them. The people in the room are integration architects. They are checking the claims in the written assessment, not looking for a polished product. Everything can be synthetic: any article length, mock systems.

Their stated priorities, in order: **statefulness and human-in-the-loop** (functional), then **AI and developer experience**, then commercials (written, not demonstrated). The running order below follows that. Item-by-item coverage is in [docs/poc-checklist.md](docs/poc-checklist.md), the mapping to their criteria sheet is in [docs/criteria-crosswalk.md](docs/criteria-crosswalk.md), and the draft written summary is [docs/poc-written-summary.md](docs/poc-written-summary.md).

**What to say in the first minute.** Editorial work spans rules, AI, people and downstream systems, and each can pause, fail or change course. The point of an orchestration layer is that **state lives in the process, not in your code or your people's heads**: one history per article, whatever happens. We did not write retry logic, waiting, timers, a task screen or an audit log. Those are configuration.

## Status: what has and has not run on the cluster (25 Oct)
- **Has run:** the clean path (4 articles on the earlier version, each approved and published after a retry); the compliance agent calling its tools and returning a structured verdict, passing a clean article and failing the AI-check article with reasons; a banned-term article routed to revision; and, on the current version, **one article that failed the agent, was revised and resubmitted with new text, passed on a fresh agent conversation, was approved by an editor, retried its publish and completed** in a single instance.
- **Has not run:** delegation, the timeout to Abandoned, the API start script, a word-count failure, a missing-headline failure, a human rejection routing back, and the prompt-injection sample. Dry-run all of these.
- **Identity:** an approval completed from the Editor tasks page leaves no assignee in the history. Tasklist records the person. **For the live session, approve the pre-seeded task in Tasklist**, so the approver shows in the audit trail, and use the Editor tasks page to show embedding.
- **Owned by the presenter:** the engine restart test, recorded separately.

## Before the session
1. **Deploy** form, then DMN, then BPMN (the fixed version). The approval form now shows the AI summary, the checks and claims with no named source, and the agent returns those two new fields (`summary`, `claimsNeedingSources`); **preview the form in Web Modeler before deploying**. Instances started before this deploy have no summary or claims, and the form and Editor tasks page simply leave those parts out. Waiting instances on older versions keep their old behaviour: **cancel the old ones** (or migrate them in Operate) so the demo starts clean.
2. **Environment:** cluster secrets `PUBLISHER_SUPABASE_KEY`, `BEDROCK_API_ACCESS_KEY`, `BEDROCK_API_ACCESS_SECRET` present. `MOCK_CMS_BASE_URL` in the app reachable **from the cluster** and not blocked by Vercel SSO. `NEXT_PUBLIC_SHOW_TEST_BUTTON=true` (turn it off afterwards).
3. **People:** the editors listed in the **Reassign to** control (`lib/editors.js`, default `john` and `alice`, or set `NEXT_PUBLIC_EDITOR_USERNAMES`) must be real Camunda usernames, and the API client needs permission to update user tasks. The four writers on the Submit page are simulated (fictional names; the writer travels as the `submittedBy` variable, visible in Operate, and Camunda's history shows the API client as the starter). **Editors must be real, separate Camunda users**, not simulated: two editors (for example `editor1`, `editor2`) in candidate group `editors`, plus a manager who can reassign tasks, with Tasklist access. Use a second browser profile for the second editor.
4. **Rules data:** the 150-word minimum is switched off (the customer said length does not matter); the maximum is 1,200.
5. **Pre-seed instances so nothing waits in front of the room.** The AI review takes about 45 seconds (the first model call alone about 24). About 10 minutes before:
   - one clean article **waiting at editor approval**
   - one AI-check article **waiting for a revision** (so Revisions has content and a reason)
   - one **completed** article for the audit trail
   - optionally a timeout instance, started with `--revision-timeout PT2M`, timed to expire during the session
6. **Tabs open:** the app (Submit, Revisions, Editor tasks, Admin), Operate, Tasklist, and a terminal in the repo with `.env.local` filled in.
7. **Fallbacks:** if the AI step or cluster is slow, use the pre-seeded instances and narrate. If the web app is down, the API script plus Operate and Tasklist carry the whole story. Keep a recording of the main flows as a backup.

## Running order (about 45 minutes with questions)

### 1. Statefulness (about 15 minutes)

**Normal path (S1).**
1. **Start by API secured with OAuth 2.0 client credentials:** `npm run api -- start --title "SMOKE TEST - API start" --body-file docs/samples/clean-article.txt`. Point at the three steps it prints: the token request (`client_credentials`), the start call with a redacted bearer token, the instance key. Show the instance in Operate. (The Submit form uses the same token server-side.) Start it early and narrate while the agent runs.
2. Walk it in Operate: the reference-data lookups, the DMN rules, then the compliance agent.
3. Switch to the pre-seeded instance waiting at **editor approval**. It has been waiting; nothing is holding a thread or a connection. That is the point.
4. After approval, the publish fails once (mock HTTP 500). Show the retry with backoff in Operate, then success. Say: the retry is configuration on the step, not code.

**Revision loop in the same instance (S2).**
1. Pick a writer in "Writing as", then submit "Load revision test article" (a banned term). Note the **instance key**. In **Revisions**, filter by that writer: each writer sees only their own articles.
2. Show the reason on the Submit page, the article in **Revisions**, and the instance waiting in Operate.
3. In **Revisions**, click **Revise**, edit, and **Resubmit** (or `npm run api -- resubmit <id> ...`). A second resubmit for the same round is refused.
4. In Operate the **same instance key** loops back and continues. One instance, one audit trail, however many revisions.
5. S2a, the other rules in the brief: "Load too-long test article": the form shows "1,358 words · maximum 1,200 · 158 over" as you type, and the rules fail it before the AI step with a reason that states the numbers ("Article is 1358 words, over the maximum of 1200."). A banned-term failure names the terms it found. Clearing the headline fails with "Headline missing".

**Timeout (optional, the brief says only if supported).** Show the compressed timeout instance ending at **Abandoned**. The submission is marked abandoned, and a late resubmit is refused with a clear message instead of being lost.

**Work in flight when the process changes (Part E).** Criterion: "Versioning of running processes". In Operate, show instances on different process versions at the same time: each keeps the version it started on, so a change never disturbs articles already in progress. Then migrate one waiting instance to the newest version with Operate's **Migrate** and resubmit into it. If asked, this is a real story from the build: a defect in one deployed version was fixed in the next, and waiting instances moved across deliberately. Whether to tell it is your call.

**Resilience (owned by the presenter).** Play the recorded engine restart during the approval wait: the same instance, task and variables before and after, with no data loss. On the call the customer appeared to accept a recording for this (the transcript is unclear, so **[CONFIRM in writing]**). Evidence to capture: instance key, task key, article variables, task creation time, the restart itself.

### 2. Human-in-the-loop (about 10 minutes)
1. **Native Tasklist:** open the pending approval as an editor. Point at what they have in front of them without leaving the task: who wrote it, the AI's neutral summary, the rules and AI results, warnings, and claims that name no source. Claim it and approve (or reject with a reason). Say plainly: this is the native task UI, no build needed (brief item 12, "say which approach is used").
2. **Delegation:** editor 1 claims the task in Tasklist. Tasklist lets a user claim a task but **not assign it to someone else** (checked as a normal user), so the manager reassigns through the API: the **Reassign to** control on the Editor tasks page, or `npm run api -- assign <taskKey> --to <username>` as the fallback. Editor 2 then completes it in Tasklist, which records them as the actor. Say plainly that the reassignment itself is made by the API client, so the history shows the client for that step. One method is enough for the demo, as agreed on the call. In the written criteria, also cover automated reassignment, escalation and role-based assignment.
3. **Embedding in your own tools:** show the **Editor tasks** page, which lists and completes the same tasks purely through the API, working at phone width. It adds statistics calculated from the text (read time, sentences, quotations, attribution phrases, figures, word count against the limits). Say these are plain facts for the editor, not judgements. Say: this is how the customer's own CMS or portal could host approvals. Be candid that it completes through an API client, so the history would show the client; the governed path for real approvals is Tasklist with the person's own login.
4. Rejection (S3): reject with a reason; show the reason reaching the submitter and the loop.
5. Mention, without demonstrating: identity-provider login for tasks and SLA escalation timers are covered in the written responses.

### 3. AI (about 10 minutes)
1. **The agent pattern on the canvas.** The compliance agent is a node on the process, not a separate studio. It is bounded to 6 model calls and its tools are read-only (banned terms, and the style guide by topic).
2. **S2b, AI fails while the rules pass:** submit "Load AI-check test article". The DMN passes it; the agent fails it for unattributed allegations and loaded language. In Operate show its tool calls and its structured verdict. The submitter gets the reasons and suggested fixes, each naming a style rule. Say: the rules cannot judge this; the agent can, and a person still decides before publish.
3. **Governance:** rules run first, a person decides last, output is validated against a schema, the whole conversation is kept in the audit trail. Optional: the injection sample (`docs/samples/injection-article.txt`) tells the reviewer to ignore its instructions. Run it before the session and show it only if it behaves; it is defence in depth, not a guarantee.
4. **AI as a governed service.** Their model is that an AI team owns AI behind APIs. Show [docs/ai-compliance-contract.md](docs/ai-compliance-contract.md): the process depends on a contract (article in, structured verdict out). The agent is one implementation; the stand-in at `/api/llm-ops/compliance-check` is another, and it can simulate outages (`[simulate-503]`, `[simulate-429]` in the headline) to show retry behaviour. Pointing the step at their service changes one step.

### 4. Developer experience (about 5 minutes)
- **What was built versus configured:** one BPMN (19 flow nodes), one DMN table (5 rules), one form, and **zero custom worker code**. The web app (about 1,200 lines) stands in for their CMS, notification and front end. The whole PoC, including that app and its tests, took about a week.
- **Open standards and Git:** BPMN, DMN and OAuth; the files are in a Git repository and Web Modeler syncs to it.
- **Safe to change:** the linter and smoke test catch the mistakes we actually made (a missing default flow, a dropped message payload).
- Whether to mention that much of it was built conversationally with an AI assistant is your call (criterion: "AI skills for conversation-driven process build").

### 5. The business view and audit trail (about 3 minutes)
1. Open the **completed** instance in Operate: every step, start and end time, the decisions as variables (`complianceResult`, `aiComplianceResult`, `approvalDecision`, `revisionReason`), and the agent's conversation and tool calls. **Verify on the cluster that the real approver appears**, and say plainly which fields come from the system rather than a person.
2. Open **Admin**: the KPI strip (first-pass rate, average revision rounds, median time to publish, publish retries, abandonment). Because state lives in the process, these are measurable. Be clear they are calculated from the app's record; Operate is the system of record.

## Close (1 minute)
Tie back to their capability table: durable state, pause and resume, loop-back in one instance, retry, human-in-the-loop, AI as a governed step with audit, start by API. Then the three business points: one history per article, running work is not disturbed by change, AI sits behind a contract your own team can own.

## Anticipated questions
- **Is it really agentic?** Yes: an AI Agent sub-process, so the model chooses which tools to call and how often within a bounded loop. The BPMN does not script the sequence. Use "agent" for this step only.
- **Can the AI be wrong?** Rules first, a person last, the whole conversation audited.
- **What stops an article manipulating the AI?** It is untrusted data, the tools are read-only, rules run before and a person after. Defence in depth, not a guarantee.
- **What if the AI service is down?** The step is retried with backoff. After that it raises an incident for an operator. A fallback that routes to a person with an "AI unavailable" flag is the natural next step and is not built yet **[CONFIRM whether to build before the session]**.
- **Can we use our own AI service or gateway?** Yes by design: see the contract. The AI Agent template also lists an OpenAI-compatible custom endpoint, which is untested.
- **Data residency?** The cluster is in Sydney **[CONFIRM]**; confirm that the Bedrock inference also stays in Australia before claiming it.
- **What if the engine restarts?** Play the recording.
- **How much did you code?** Zero worker code. A stand-in web app for their systems. See the configured-versus-coded table in the written summary.
- **How long did it take?** About a week, including the stand-in app and tests.
- **Does a process change disturb articles in progress?** No, each keeps its version; migration is deliberate (Part E).
- **Identity provider login, SLA escalation, other deployment models, pricing?** Written responses. Pricing is based on the volume they gave: a small number of workflows and executions, so the pricing basis matters more than capacity.
- **Email instead of the notification stub?** The brief allows email; the email connector can replace the stub.

# Stateful orchestration PoC: written summary (DRAFT)

> **Draft status.** Written 25 October 2026 from what has been built and what has run on the cluster. Items marked **[CONFIRM]** or **[PENDING]** must be settled before this is sent. Update the status column in section 4 from the latest dry run. Nothing here claims more than has been observed.

## 1. What was built, and the emphasis
The editorial content approval scenario from the brief, end to end: submit by API or form, automated checks (deterministic rules, then an AI review), human editorial approval, a revision loop inside the same process instance, a simulated publish that fails once and is retried, and a full audit trail. Everything outside the orchestration platform is synthetic (mock CMS, mock notification, reference data in a small database), as agreed on the clarification call.

The customer named statefulness and human-in-the-loop as the two most important functional areas, with AI and developer experience next. The build and the demo are weighted the same way.

## 2. Architecture and deployment model
- **Platform:** Camunda 8 SaaS, version 8.10, one cluster in the Sydney region **[CONFIRM region]**. Engine, Operate and Tasklist are the product. Processes are modelled in Web Modeler with Git sync to a repository. Service steps run on the hosted connector runtime (HTTP connector and AI Agent connector). There is no custom worker code to deploy or operate.
- **AI:** an AI Agent sub-process calling a foundation model on AWS Bedrock in ap-southeast-2 **[CONFIRM that inference stays in Australia]**. Credentials are held in the cluster secret store.
- **Starting a process:** the REST API with an OAuth 2.0 client-credentials token. A script demonstrates the token request and the start call with the token redacted.
- **Stand-in systems (not part of the product):** a small web app (submission form, mock CMS and notification endpoints, a revisions list, an API-driven task list and an admin view) and a database holding reference data and a record of each submission.

## 3. Configured versus coded

| Part | Size | Nature |
|---|---|---|
| Process definition | 1 BPMN, 19 flow nodes | Configured in Web Modeler |
| Business rules | 1 DMN table, 5 rules | Configured |
| Approval form | 1 form, 4 fields | Configured |
| Custom worker or job-handler code | **0** | Not needed: HTTP and AI Agent connectors only |
| Stand-in web app | about 1,200 lines of JavaScript | Stands in for the customer's own systems |
| Test and tooling scripts | about 750 lines | Ours, for repeatability; not part of a deployment |

Behaviour that is **configuration, not code**: durable waiting, message correlation for resubmission, timers, retry with backoff, the human task and its assignment, the audit history, and incident handling. The whole PoC, including the stand-in app and tooling, was built over about a week.

## 4. Coverage of the scenario (status on the cluster as of 25 Oct; refresh before sending)

| Brief item | How it is met | Status |
|---|---|---|
| Submit by API or form, OAuth 2.0 client credentials | REST start with a client-credentials token; form for the live demo | Form run on cluster. API script **[PENDING run on cluster]** |
| Automated check as an AI step | Deterministic rules (DMN) then an AI Agent sub-process with read-only tools and a structured verdict | Run on cluster: the agent calls its tools, returns a structured verdict, passes a clean article and fails an AI-check article with reasons |
| Revision Required, same instance, reason sent | Waiting state until a resubmission message; reason and suggested fixes sent; loop back to the check | Run on cluster: reasons and fixes sent, waiting in the same instance, loop back with the new text (a defect where it was ignored was found and fixed) |
| Optional timeout to Abandoned | Timer on the waiting state; compressible for demo; marks the submission abandoned | **[PENDING run on cluster]** |
| Human approval, note which approach | Native Tasklist, plus an API-driven task list as an embedding example | Run on cluster: Tasklist approvals (earlier version), and an approval through the API-driven page on the current version |
| Delegation | A manager reassigns a pending task (one method, as agreed) | **[PENDING run on cluster]** |
| Mock publish fails once, automatic retry | Per-step retries and backoff | Run on cluster |
| Complete, with full audit trail including AI input and output | Operate history; the agent's conversation, tool calls and verdict are held with the instance | Visible in Operate. The approver is recorded for Tasklist approvals and empty for API-completed ones |
| Engine restart during the approval wait | Recorded separately, as discussed on the call | **[PENDING recording]** |

## 5. Deviations from the scenario, and why
- **Notification is an HTTP stub**, not email. The brief allows either. The reason is shown to the submitter in the app.
- **The AI check is an agent on Bedrock**, not a call to the customer's own AI service. The customer's model is that a separate team owns AI behind APIs, so the process depends on a defined contract (see `ai-compliance-contract.md`) that the agent and a stand-in service both implement. Pointing the step at the customer's service changes one step.
- **Deterministic rules run before the AI step**, in DMN. The brief describes the rules as the AI step's job. Splitting them makes the AI step the second gate and keeps hard limits deterministic.
- **The AI step is an addition beyond a single call**: a bounded agent loop with tools, included to show the agent pattern.
- **Human approval:** the native Tasklist is the governed path. The API-driven task list shows tasks can be embedded in the customer's own tools, but it completes tasks through the API client, so the history shows the client rather than the person. It is a demonstration, not a recommendation.
- **The demo web form's own endpoint is not OAuth-protected.** The platform's API is.
- **Delegation:** one method is shown (manager reassignment). Automated reassignment and escalation are covered in the written criteria responses.

## 6. Not demonstrated, and why
- **SLA and escalation on human tasks, role-based and rule-based assignment:** not in the scenario. Covered in the written criteria. A reminder and escalation timer on the approval task is a small extension.
- **Customer identity provider login for tasks:** needs the customer's provider. Covered in the written criteria.
- **Parallel branches, event streaming, multi-agent coordination:** excluded by the brief ("no complex branching").
- **Fallback to a human when the AI step is unavailable, and confidence thresholds:** the step is bounded, retried and returns a structured verdict, but the fallback path is not built **[CONFIRM whether to build before the demo]**.
- **Scalability and load:** excluded by the brief.
- **Dashboards beyond the engine's own tools:** the KPI strip in the admin view is calculated from the app's record, not from the engine.

## 7. What this means in practice
- **State lives in the process.** One history per article across every revision, so rework rate, time to publish and abandonment can be measured.
- **Running work keeps the version it started on.** Changing a process definition does not disturb articles in flight, and migration is a deliberate step. The demo shows instances on different versions side by side.
- **AI is a governed step.** Rules run first, a person decides last, the loop is bounded, and the input, output, model and rules checked are kept with the instance.
- **Open standards.** BPMN 2.0, DMN, OAuth 2.0 and Git. The files in the repository are the deliverable.

## 8. Assumptions
Synthetic articles of any length; mock systems throughout; a single cluster and tenant; pricing and sizing handled separately from this PoC.

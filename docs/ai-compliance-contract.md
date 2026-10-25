# AI as a governed service: the compliance check contract

## Why this exists
The customer's operating model, as stated in the PoC brief, is that a separate team owns all AI and LLM build and exposes it through APIs. The orchestration layer's job is to *consume* AI as a governed step, not to host the team's models or prompts. So the process should depend on a **contract**, not on a model.

The contract is in [ai-compliance-check.openapi.yaml](ai-compliance-check.openapi.yaml): an article goes in, a structured verdict comes out (`verdict`, `reasons`, `warnings`, `suggestedFixes`, `rulesChecked`, plus a neutral `summary` and a list of `claimsNeedingSources` for the human reviewer, and model id and request id for audit). Calls are OAuth 2.0 client-credentials secured and carry an idempotency key.

## Two implementations, one contract

| Implementation | What it is | Where it sits |
|---|---|---|
| **Compliance review agent** (in the BPMN today) | An AI Agent sub-process on the process canvas: the model chooses between read-only tools (banned terms, style guide by topic) in a loop bounded to 6 model calls, and returns the same structured verdict | Agent pattern "in-model visual representation": the agent is a node on the canvas |
| **AI service behind an API** (stub in this repo: `POST /api/llm-ops/compliance-check`) | A deterministic, rule-based stand-in for the service the LLM Ops team would implement and own | The process calls it over HTTP like any other system |

Both return the same JSON shape, so everything downstream (the gateway, the revision notification, the Editor tasks view, the audit trail) is identical. Changing implementation changes one step, not the process.

## What the process guarantees whichever implementation is used
- **Rules first, human last.** Deterministic rules run before the AI step. A person approves after it. The AI step is one gate, not the decision.
- **Structured output.** The verdict is validated against a schema. A missing or malformed verdict takes the safe path (back to revision), never an approval.
- **Bounded and retried.** Timeouts, retries and backoff are set per step. A failed call is retried; it never silently passes an article.
- **Audited.** The article sent, the verdict returned, the rule keys checked, the model id and the request id are kept with the instance, alongside the human steps.
- **Untrusted input.** The article is data. Instructions inside it are never followed, and the stub and the agent both fail an article that tries to instruct the reviewer.

## Error semantics (so retries do the right thing)
| Response | Meaning | The process should |
|---|---|---|
| 400 | Bad request | Not retry. This is a defect, raise an incident |
| 401, 403 | Token missing or not allowed | Not retry. Raise an incident |
| 429 | Rate limited (`Retry-After`) | Retry with backoff |
| 503, 504 | Unavailable or timed out | Retry with backoff, then take the fallback path |

The stub can simulate the retryable cases for a live demonstration: put `[simulate-503]` or `[simulate-429]` in the headline, or `[simulate-slow]` for a 5 second delay.

## Swapping the agent for an AI service (not wired in yet)
This replaces the agent sub-process with one HTTP task. It is a design choice, because it trades the agentic demonstration for a faithful "simple API call" and deterministic results. Make the change in Web Modeler.

An HTTP connector task (`io.camunda:http-json:1`) with these inputs:
- `method`: `POST`
- `url`: `=mockCmsBaseUrl + "/api/llm-ops/compliance-check"` (any base URL; use the real service's in production)
- `headers`: `={"Idempotency-Key": submissionId + ":r" + string(if revisionRound != null then revisionRound else 0)}` (add OAuth client-credentials authentication on the task for a real service)
- `body`: `={article: {title: articleTitle, body: articleBody}, context: {submissionId: submissionId, round: (if revisionRound != null then revisionRound else 0) + 1}}`
- `connectionTimeoutInSeconds` and `readTimeoutInSeconds`: `60`
- task definition retries `3`, header `retryBackoff` `PT10S`
- result header `resultExpression`: `={aiComplianceResult: {responseJson: response.body}}`

The last line makes the response look exactly like the agent's output, so the "AI check passed?" gateway (`aiComplianceResult.responseJson.verdict`), the revision notification and the Editor tasks view work unchanged.

## What is not covered yet
- **A fallback path when the AI service is unavailable.** After the retries are exhausted the instance raises an incident for an operator. A stronger design routes it to a human with an "AI unavailable" flag instead. The customer's criteria ask about fallback paths for non-deterministic steps, so this is the next thing to build.
- **Confidence thresholds.** The verdict is pass or fail with reasons. There is no score to threshold on.

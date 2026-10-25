# Vendor assessment criteria: what the PoC evidences

The customer's assessment sheet lists 70 criteria across 14 categories. This maps each one to what the PoC can show, so the live session and the written summary point at evidence. It does not answer the criteria: the written responses come from the product documentation.

**Status key**
- **Shown**: the PoC demonstrates it (status as of 25 Oct; see the checklist for what has run on the cluster).
- **Partly**: the PoC shows part of it.
- **Plan**: it can be shown in the live session with a small step, but has not been shown yet.
- **Written**: not something the PoC can evidence. Answer from product documentation and do not claim it from the PoC.

The customer's stated priorities were statefulness and human-in-the-loop first, then AI and developer experience, then commercials. Those categories come first below.

## Workflow Execution (priority)
| Criterion | PoC evidence | Status |
|---|---|---|
| Durable execution and restart behaviour | Engine restart during the approval wait, recorded separately as discussed on the call | Plan (owner: recording) |
| Long-running process support | Approval wait has no timer or limit; the revision wait uses a durable timer | Partly (maximum duration is a written answer) |
| Pause and resume without data loss | Approval and revision waits resume with all data | Shown |
| Parallel execution and concurrency | The agent runs its tool calls in parallel inside its loop (seen in Operate). No parallel branches, excluded by the brief | Partly |
| Error handling and retry | Publish fails once and is retried with backoff, set per step. Compensation and rollback not shown | Shown (retry), Written (compensation) |
| **Versioning of running processes** | Instances on different process versions run side by side in Operate; each keeps its version. Migration is a deliberate step | Plan: show Operate migration (see the demo script, Part E) |
| Event-driven triggers | API start and message correlation for resubmission. Queue, webhook and stream triggers not shown | Partly |

## Human-in-the-Loop (priority)
| Criterion | PoC evidence | Status |
|---|---|---|
| Identity provider login for task completion (for example Okta) | Not demonstrable without the customer's provider | Written |
| Mobile and responsive access | The custom task list and every demo page work at phone width. The native task UI is not checked | Partly |
| Task assignment logic (role, rule, dynamic, escalation) | Candidate group `editors`; a manager reassigns a task. Rule-based and dynamic assignment not shown | Partly |
| SLA and escalation management | Not in the scenario; a reminder and escalation timer on the approval task is a small extension | Written (or build) |
| Licensing of human task features | Not a PoC matter | Written |
| Delegation (from the call) | One method, a manager reassigning, was agreed as enough | Plan |

## AI and Agentic Workflow (priority)
| Criterion | PoC evidence | Status |
|---|---|---|
| Agent architecture pattern (a in-model, b agent builder, c bring your own) | (a): the agent is an ad-hoc sub-process on the canvas. (c) is available through the platform's MCP client connector and an agent-to-agent connector (alpha), not demonstrated | Shown (a), Written (b, c) |
| Non-deterministic step handling (retries, confidence, fallback) | Retries, a bounded loop, temperature 0, structured output. No confidence threshold, and no fallback to a human yet | Partly |
| Multi-agent orchestration | Not shown | Written |
| Agent output governance | Output validated against a schema; rules run first and a person decides last; the verdict names the rules checked | Shown |
| Audit trail for agent decisions | The agent's conversation, tool calls and verdict are held with the instance in Operate | Shown |

## Design and Modelling (developer experience)
| Criterion | PoC evidence | Status |
|---|---|---|
| Modelling notation | BPMN 2.0 and DMN | Shown |
| Low-code and no-code design | Visual Web Modeler; zero custom worker code | Shown |
| Reusability | Connectors and element templates used. Shared sub-processes not used | Partly |
| Version control integration | Web Modeler Git sync: the repository history contains the sync commits | Shown |
| Testing and simulation | Our own tooling (smoke test, linter, a fake of the API) was built around it. The platform's own test tooling was not used | Partly |

## Integration and Connectivity
| Criterion | PoC evidence | Status |
|---|---|---|
| Expose processes as APIs | Start and message APIs called with an OAuth token | Shown |
| Connector ecosystem | HTTP and AI Agent connectors used | Partly |
| Event streaming (Kafka or similar) | Not shown | Written |

## Governance and Compliance
| Criterion | PoC evidence | Status |
|---|---|---|
| Data residency (Australian region) | Cluster in Sydney and Bedrock in ap-southeast-2 | Plan: confirm both before claiming |
| Native task inbox and UI | The native Tasklist, plus an API-built task list | Shown |
| Role-based access control | Candidate-group assignment only | Partly |
| Change management controls across environments | Not shown | Written |
| Audit logging (what, retention, immutability) | Operate history. Retention and immutability not evidenced | Partly |

## Monitoring and Observability
| Criterion | PoC evidence | Status |
|---|---|---|
| Real-time process visibility | Operate shows in-flight instances, the current step and timing | Shown |
| Alerting (SLA, errors, stalled processes) | Incidents appear in Operate. Alert routing not shown | Partly |
| Metrics and dashboards | A KPI strip in the admin view, calculated from the app's record. Engine-side dashboards not shown | Partly |
| Historical reporting | Completed instances in Operate; the admin list | Partly |

## Security and Identity
| Criterion | PoC evidence | Status |
|---|---|---|
| Authentication and SSO (SAML or OIDC) | Machine-to-machine OAuth 2.0 client credentials shown. User SSO not | Partly |
| Encryption | Not a PoC matter | Written |
| Secrets management | Connector secrets are referenced from the cluster secret store, never held in the process | Shown |
| Network security | Not shown | Written |
| Vulnerability management | Not a PoC matter | Written |

## Platform and Infrastructure
| Criterion | PoC evidence | Status |
|---|---|---|
| Deployment models | SaaS used. Others are written answers | Partly |
| Scalability and benchmarks | Excluded by the brief | Written |
| High availability and disaster recovery | Related to the restart test | Plan (with the recording) |
| Multi-region and an Australian region | Sydney cluster | Plan: confirm |
| Upgrade and patching without downtime to in-flight work | Related to the restart test and to process versioning | Written |

## Developer Experience (priority)
| Criterion | PoC evidence | Status |
|---|---|---|
| SDKs and languages | No custom workers were needed. The REST API was called from Node | Partly |
| AI skills for conversation-driven process build | How much of this PoC was built conversationally is the presenter's call to make | Written |
| Local development | The stand-in app and a fake of the API run locally. The process itself needs a cluster | Partly |
| CI/CD integration | Git sync only; no pipeline | Written |
| Documentation and community | Built from the product documentation and the public API specification | Partly |
| Learning curve | The whole PoC took about a week | Partly |

## Commercial and Vendor Viability
Pricing model, licensing transparency, total cost, set-up cost, references, product maturity, roadmap and regional support are written responses. The customer supplied an indicative volume for pricing: 10 workflows in year one growing 30% a year, and 1,000 executions per workflow per year growing 10% a year. That volume is small, so the pricing basis matters more than the platform's capacity.

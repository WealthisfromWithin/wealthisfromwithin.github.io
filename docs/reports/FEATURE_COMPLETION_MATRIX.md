# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 5 (Cognition). Baseline column is the Wave 0 audit.

| Module | Baseline % | Wave 1 % | Wave 2 % | Wave 3 % | Wave 4 % | Wave 5 % | Δ (W4→W5) | Notes |
|--------|-----------:|---------:|---------:|---------:|---------:|---------:|----------:|-------|
| Knowledge Base | 0 | 0 | 0 | 0 | 0 | 55 | +55 | `/knowledge` with a node detail route: capture, pin, review, archive, tags, and local joins rendered from both ends. No embeddings and no similarity — links are the ones someone typed. |
| Memory | 0 | 0 | 0 | 0 | 0 | 55 | +55 | `/memory` over kind and scope, with provenance (stated/observed/inferred) rather than a confidence score, review dates that decay, recalls counted, and retirement instead of deletion. No extraction from conversations. |
| Decision Log | 0 | 0 | 0 | 0 | 0 | 55 | +55 | `/decisions` plus `/decisions/entry/:id`, behind a four-state transition table with supersession linked both ways. Recording a call needs both a choice and a reasoning. One-way doors are labelled. |
| Prompt Library | 0 | 0 | 0 | 0 | 0 | 50 | +50 | `/prompts` is fully usable with no provider: browse, filter by intent, edit, read the `{{placeholders}}` the body declares, rank by use count. Execution lives in `/ai`, not here. |
| Documents | 0 | 0 | 0 | 0 | 0 | 45 | +45 | `/documents` plus a document route, rendered by a block splitter that emits text nodes only — a body containing `<script>` shows those characters. Metadata and text; no upload and no hosting. |
| Research | 0 | 0 | 0 | 0 | 0 | 45 | +45 | `/research` queues questions and records findings and answers by hand. The page states there is no crawler and no search connector, and typed sources render as text rather than links. |
| AI Workspace | 0 | 5 | 5 | 5 | 5 | 35 | +30 | Sessions and turns through the Agent Kernel only, with five adapters: a local one that runs against `VITE_LOCAL_AI_URL` and four hosted ones that report `awaiting_credentials` and refuse. Refusals are written into the thread as refusals. Capped here because nothing generates without an operator-supplied endpoint. |
| Command Palette | 0 | 60 | 70 | 80 | 85 | 90 | +5 | Six cognition entries; the parity tests still require every target to resolve to a served route and pass `isSafeInternalHref`. |
| Search | 0 | 55 | 60 | 75 | 82 | 88 | +6 | Knowledge, memory, documents, decisions, prompts, and questions indexed. Fuzzy, not semantic, and nothing claims otherwise. |
| Executive Dashboard / Morning Brief | 5 | 55 | 65 | 75 | 80 | 85 | +5 | Decisions awaiting a call, decisions due for review, overdue questions, memory needing review, and agent sessions the kernel could not run. |
| Daily Brief | 0 | 55 | 65 | 75 | 80 | 85 | +5 | Delivered as the Morning Brief route. |
| System Logs | 0 | 0 | 20 | 25 | 30 | 35 | +5 | A `cognition` channel carries knowledge, memory, document, decision, research, and agent events into the recorded-events panel. |
| Settings | 0 | 30 | 30 | 30 | 30 | 35 | +5 | The kernel panel now reads the real roster and health through `@/agents`; the roadmap list shrank from nine entries to five as Wave 5 shipped. |
| Notifications | 0 | 5 | 55 | 55 | 60 | 62 | +2 | Cognition signals seeded (memory review, a recorded decision), inheriting row provenance. |
| Content Engine | 5 | 5 | 5 | 5 | 60 | 60 | 0 | Unchanged. The M1 fix pack made the Approval Queue content-aware; Wave 5 touched none of it. |
| Approval Queue | 10 | 10 | 55 | 55 | 60 | 60 | 0 | Unchanged. Agent output is policy-gated by the kernel, but no Wave 5 surface can produce output to gate. |
| Idea Vault | 0 | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. |
| Content Calendar | 0 | 0 | 0 | 0 | 50 | 50 | 0 | Unchanged. |
| Content Analytics | 0 | 0 | 0 | 0 | 45 | 45 | 0 | Unchanged. |
| Performance Learning | 0 | 0 | 0 | 0 | 40 | 40 | 0 | Unchanged. |
| Campaign Management | 0 | 0 | 0 | 0 | 40 | 40 | 0 | Unchanged. |
| Content Libraries (hooks, CTAs, assets, templates) | 0 | 0 | 0 | 0 | 40 | 40 | 0 | Unchanged. |
| Repurposing | 0 | 0 | 0 | 0 | 35 | 35 | 0 | Unchanged. |
| Video Tracking | 0 | 0 | 0 | 0 | 35 | 35 | 0 | Unchanged. |
| Compliance Check | 0 | 0 | 0 | 0 | 30 | 30 | 0 | Unchanged. |
| CRM | 0 | 5 | 5 | 60 | 60 | 60 | 0 | Unchanged. |
| Relationship Intelligence | 0 | 0 | 0 | 55 | 55 | 55 | 0 | Unchanged. Knowledge nodes and memories link to people, but nothing scores the relationship. |
| Revenue Pipeline | 0 | 5 | 5 | 60 | 60 | 60 | 0 | Unchanged. |
| Opportunity Tracker | 0 | 0 | 0 | 55 | 55 | 55 | 0 | Unchanged. |
| Lead Intelligence | 5 | 0 | 0 | 45 | 45 | 45 | 0 | Unchanged. |
| Tasks | 0 | 5 | 5 | 60 | 60 | 60 | 0 | Unchanged. |
| Projects | 0 | 0 | 0 | 45 | 45 | 45 | 0 | Unchanged. |
| Calendar | 0 | 0 | 0 | 45 | 45 | 45 | 0 | Unchanged. |
| Meeting Notes | 0 | 0 | 0 | 50 | 50 | 50 | 0 | Unchanged. |
| Health Monitor | 10 | 15 | 40 | 40 | 40 | 40 | 0 | Unchanged and still honestly offline. The four AI connectors stay `awaiting_credentials`, and `/ai` says the same thing they do. |
| MCP Connections | 0 | 30 | 30 | 30 | 30 | 30 | 0 | Registry entries with honest states. No gateway. Out of scope for Wave 5. |
| Mission Control | 5 | 5 | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| Analytics | 5 | 5 | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| Business Metrics | 5 | 5 | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| Weekly Review | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Wave 6. |
| Automation Center | 5 | 0 | 0 | 0 | 0 | 0 | 0 | Hidden until built (Wave 6). |
| Financial KPIs | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Wave 6. |

Negative deltas in the Wave 1 column were deliberate: a nav label with nothing
behind it scored points in the baseline for fake inventory. Removing it was
progress.

No Wave 5 surface scores above 55, and the AI Workspace — the module the wave is
named for — scores 35. That is the honest ceiling for a surface whose kernel can
select, gate, and refuse but whose only runnable adapter needs an endpoint the
operator supplies. A higher score would have to come from a credential this
bundle cannot hold.

## Platform aggregate

| Measure | Wave 0 | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 |
|---------|-------:|-------:|-------:|-------:|-------:|-------:|
| Weighted platform completion | ~8–12% | ~20% | ~28% | ~44% | ~52% | ~60% |
| Production readiness score | 12 / 100 | 34 / 100 | 42 / 100 | 50 / 100 | 55 / 100 | 60 / 100 |
| Enabled modules | 0 | 3 | 6 | 12 | 13 | 20 |
| Nested sub-routes | 0 | 0 | 0 | 0 | 5 | 5 |
| Record detail routes | 0 | 0 | 0 | 3 | 4 | 7 |
| Tests | 0 | 46 | 114 | 281 | 396 | 612 |

The Wave 4 test figure is the one recorded at the gate; the M1 fix pack took it
to 409 before Wave 5 began.

Wave 5 readiness gains: an Agent Kernel with a real adapter registry, a policy
it owns rather than delegates, and a refusal path that is the only way agent
output can reach the store (+2); seven cognition surfaces that each state what
they cannot do — no crawler, no embeddings, no upload, no execution from the
library (+1); a document renderer that cannot inject markup because it never
produces any (+1); and a local provider that genuinely runs when an operator
points it at their own machine, which is the first model path in this platform
that is not a stub (+1). Still zero for auth, remote persistence, and health
probes — those remain the caps on this score, not UI surface area.

Update this file each wave.

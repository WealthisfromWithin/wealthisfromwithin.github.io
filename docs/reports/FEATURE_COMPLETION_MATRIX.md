# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 3 (Revenue & Relationships). Baseline column is the Wave 0 audit.

| Module | Baseline % | Wave 1 % | Wave 2 % | Wave 3 % | Δ (W2→W3) | Notes |
|--------|-----------:|---------:|---------:|---------:|----------:|-------|
| CRM | 0 | 5 | 5 | 60 | +55 | `/crm` lists people and companies, ranked by touch recency and open value. Detail routes for both. No creation, no connectors. |
| Relationship Intelligence | 0 | 0 | 0 | 55 | +55 | On person and company detail: touch recency, open value, joined opportunities, tasks, and meetings. Arithmetic over stored fields — no scoring model. |
| Revenue Pipeline | 0 | 5 | 5 | 60 | +55 | `/pipeline` with a stage distribution strip and an expected-value-ranked list. Stage moves persist and settle closed probability. |
| Opportunity Tracker | 0 | 0 | 0 | 55 | +55 | `/pipeline/opportunity/:id` with next step, stage age, champion, and attached work. |
| Lead Intelligence | 5 | 0 | 0 | 45 | +45 | Lead source, days in stage against a 14-day stall threshold, champion temperature, overdue next step. Every signal names its source field. No enrichment. |
| Tasks | 0 | 5 | 5 | 60 | +55 | `/tasks` filters on status and priority, links each task to its project, person, and opportunity. Status changes and task creation persist. |
| Projects | 0 | 0 | 0 | 45 | +45 | `/projects` with progress counted from linked tasks and blocked reasons stated. List only, no project mutations. |
| Calendar | 0 | 0 | 0 | 45 | +45 | `/calendar` merges meetings and task due dates into one week agenda. Read-only; no scheduling, no external calendar. |
| Meeting Notes | 0 | 0 | 0 | 50 | +50 | `/meetings` records with an inline notes editor writing to Dexie. Nothing transcribed. |
| Executive Dashboard / Morning Brief | 5 | 55 | 65 | 75 | +10 | Opportunity and today sections now read the pipeline and calendar selectors, so brief and module can no longer disagree. Blocked projects join the blocked section. |
| Daily Brief | 0 | 55 | 65 | 75 | +10 | Delivered as the Morning Brief route. |
| Command Palette | 0 | 60 | 70 | 80 | +10 | Six Wave 3 actions; targets are now checked against the record-link allowlist, not just router parity. |
| Search | 0 | 55 | 60 | 75 | +15 | Projects and meetings indexed; people, companies, and opportunities route to their detail pages. |
| Notifications | 0 | 5 | 55 | 55 | 0 | Unchanged. Seeded hrefs repointed at the new detail routes. |
| Approval Queue | 10 | 10 | 55 | 55 | 0 | Unchanged. |
| Health Monitor | 10 | 15 | 40 | 40 | 0 | Unchanged and still honestly offline. New CRM connectors stay `awaiting_credentials`. |
| System Logs | 0 | 0 | 20 | 25 | +5 | Two new event channels (`execution`, `relationship`) flow into the same recorded-events panel. |
| MCP Connections | 0 | 30 | 30 | 30 | 0 | Registry entries with honest states. No gateway. |
| Settings | 0 | 30 | 30 | 30 | 0 | Roadmap list shrank as six modules shipped. |
| Mission Control | 5 | 5 | 5 | 5 | 0 | Re-waved from 3 to 6; blocked missions still surface in the brief only. |
| Analytics | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| Business Metrics | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| Content Engine | 5 | 5 | 5 | 5 | 0 | `ContentItem` entity only. Wave 4. |
| AI Workspace | 0 | 5 | 5 | 5 | 0 | Kernel interface plus refusing stub. Wave 5. |
| Prompt Library | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Knowledge Base | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Memory | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Weekly Review | 0 | 0 | 0 | 0 | 0 | Wave 6. |
| Research | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Automation Center | 5 | 0 | 0 | 0 | 0 | Hidden until built (Wave 6). |
| Documents | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Financial KPIs | 0 | 0 | 0 | 0 | 0 | Wave 6. |
| Idea Vault | 0 | 0 | 0 | 0 | 0 | Wave 4. |
| Content Calendar | 0 | 0 | 0 | 0 | 0 | Wave 4; exists in ContentDone. |
| Decision Log | 0 | 0 | 0 | 0 | 0 | Wave 5. Task, stage, and note events are recorded as activity, but the module is not built. |

Negative deltas in the Wave 1 column were deliberate: a nav label with nothing
behind it scored points in the baseline for fake inventory. Removing it was
progress.

No Wave 3 module scores above 60. Each one reads and mutates a local store with
no remote persistence, no creation flow beyond tasks, and no external data
source. The ceiling is honest, not modest.

## Platform aggregate

| Measure | Wave 0 | Wave 1 | Wave 2 | Wave 3 |
|---------|-------:|-------:|-------:|-------:|
| Weighted platform completion | ~8–12% | ~20% | ~28% | ~44% |
| Production readiness score | 12 / 100 | 34 / 100 | 42 / 100 | 50 / 100 |
| Enabled modules | 0 | 3 | 6 | 12 |
| Record detail routes | 0 | 0 | 0 | 3 |
| Tests | 0 | 46 | 114 | 281 |

Wave 3 readiness gains: six operable revenue and relationship surfaces backed by
tested joins (+5), a brief that reads the same selectors its modules render so
the two cannot disagree (+2), and route-level code splitting with a href
allowlist extended to dynamic record ids (+1). Still zero for auth, remote
persistence, health probes, and agent runtime — those remain the caps on this
score, not UI surface area.

Update this file each wave.

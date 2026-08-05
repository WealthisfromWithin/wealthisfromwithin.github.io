# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 6 (Leverage Fabric). Baseline column is the Wave 0 audit.

| Module | Baseline % | Wave 1 % | Wave 2 % | Wave 3 % | Wave 4 % | Wave 5 % | Wave 6 % | Δ (W5→W6) | Notes |
|--------|-----------:|---------:|---------:|---------:|---------:|---------:|---------:|----------:|-------|
| Automation Center | 5 | 0 | 0 | 0 | 0 | 0 | 55 | +55 | `/automations` plus `/automations/rule/:id`: eight declared triggers over the local store, four actions of which three write locally and the fourth always refuses, gates through the existing Approval Queue, and a run log that records the runs that did nothing. Capped because nothing runs on a timer and no hand-off can leave the browser. |
| Mission Control | 5 | 5 | 5 | 5 | 5 | 5 | 55 | +50 | `/missions` plus `/missions/mission/:id`: objectives with declared and counted progress printed side by side and never averaged, tasks, projects, deals, and campaigns linked to them, blockers collected from the work beneath, and a "nothing serves it" state. No forecast. |
| Business Metrics | 5 | 5 | 5 | 5 | 5 | 5 | 50 | +45 | `/metrics`: five KPI groups counted from the domain, each card carrying its basis, sample size, and demo provenance. Rates refuse rather than round. Recorded metric rows are quarantined as declared. Capped because no cost, margin, or cash figure exists in the store. |
| Analytics | 5 | 5 | 5 | 5 | 5 | 5 | 50 | +45 | `/analytics`: activity by day, channel mix, throughput per surface split into created and touched, six loop readings with their bases, and store provenance. Capped honestly — nothing observes the operator, so this counts writes rather than usage. |
| Financial KPIs | 0 | 0 | 0 | 0 | 0 | 0 | 45 | +45 | Delivered inside `/metrics`: closed-won value, open and weighted pipeline, win rate, average deal, and value in stalled deals. Recognition is by stage change, and the page says nothing here was reconciled against money that moved. |
| MCP Connections | 0 | 30 | 30 | 30 | 30 | 30 | 45 | +15 | `/integrations/mcp` reads the same registry rows as `/integrations` and adds transport, ownership, purpose, and the gap for each of 5 declared servers. No client ships, so nothing is Connected and the panel says why. Still no gateway. |
| Command Palette | 0 | 60 | 70 | 80 | 85 | 90 | 94 | +4 | Seven leverage entries — two actions and five surfaces. Parity tests still require every target to resolve to a served route and pass `isSafeInternalHref`. |
| Search | 0 | 55 | 60 | 75 | 82 | 88 | 90 | +2 | Automation rules indexed, missions routed to their record page, and MCP hits routed to the MCP panel rather than the full registry. |
| Executive Dashboard / Morning Brief | 5 | 55 | 65 | 75 | 80 | 85 | 88 | +3 | Automation gates as one aggregate attention line, rules that cannot run in Blocked, blocked objectives from Mission Control, and what the run log actually did in Leverage. |
| Daily Brief | 0 | 55 | 65 | 75 | 80 | 85 | 88 | +3 | Delivered as the Morning Brief route. |
| Approval Queue | 10 | 10 | 55 | 55 | 60 | 60 | 65 | +5 | A second producer: an automation gate carries `automationRunId`, and deciding it writes the effect the run deferred or records the run as declined. The Wave 4 content branch is untouched. |
| Notifications | 0 | 5 | 55 | 55 | 60 | 62 | 65 | +3 | Automation signals are written by the run that claims them, and a gated run writes none until a human clears the gate. |
| System Logs | 0 | 0 | 20 | 25 | 30 | 35 | 38 | +3 | The `automation` channel now carries rule definitions, runs, and mission writes into the recorded-events panel. |
| Settings | 0 | 30 | 30 | 30 | 30 | 35 | 38 | +3 | The roadmap list shrank from five entries to one — Command API Sync — as Wave 6 shipped. |
| Content Analytics | 0 | 0 | 0 | 0 | 45 | 45 | 47 | +2 | Unchanged surface. `/metrics` and `/analytics` read the same readings and both state they were entered by hand. |
| Revenue Pipeline | 0 | 5 | 5 | 60 | 60 | 60 | 62 | +2 | Unchanged surface; opportunities can now point at an objective, and stall age is read by both an automation trigger and a KPI. |
| Knowledge Base | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. |
| Memory | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. A memory past its review date is now also an automation trigger. |
| Decision Log | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. An overdue call is now also an automation trigger. |
| Prompt Library | 0 | 0 | 0 | 0 | 0 | 50 | 50 | 0 | Unchanged. |
| Documents | 0 | 0 | 0 | 0 | 0 | 45 | 45 | 0 | Unchanged. |
| Research | 0 | 0 | 0 | 0 | 0 | 45 | 45 | 0 | Unchanged. |
| AI Workspace | 0 | 5 | 5 | 5 | 5 | 35 | 35 | 0 | Unchanged. No automation can invoke the kernel: a rule that produced text would be a generation path outside `/ai`. |
| Content Engine | 5 | 5 | 5 | 5 | 60 | 60 | 60 | 0 | Unchanged. The n8n fan-out rule exists and always refuses, which is the same boundary the Content OS states. |
| Idea Vault | 0 | 0 | 0 | 0 | 55 | 55 | 55 | 0 | Unchanged. |
| Content Calendar | 0 | 0 | 0 | 0 | 50 | 50 | 50 | 0 | Unchanged. |
| Performance Learning | 0 | 0 | 0 | 0 | 40 | 40 | 40 | 0 | Unchanged. |
| Campaign Management | 0 | 0 | 0 | 0 | 40 | 40 | 40 | 0 | Unchanged. Campaigns can now point at an objective. |
| Content Libraries (hooks, CTAs, assets, templates) | 0 | 0 | 0 | 0 | 40 | 40 | 40 | 0 | Unchanged. |
| Repurposing | 0 | 0 | 0 | 0 | 35 | 35 | 35 | 0 | Unchanged. |
| Video Tracking | 0 | 0 | 0 | 0 | 35 | 35 | 35 | 0 | Unchanged. |
| Compliance Check | 0 | 0 | 0 | 0 | 30 | 30 | 30 | 0 | Unchanged. |
| CRM | 0 | 5 | 5 | 60 | 60 | 60 | 60 | 0 | Unchanged. |
| Relationship Intelligence | 0 | 0 | 0 | 55 | 55 | 55 | 55 | 0 | Unchanged. |
| Opportunity Tracker | 0 | 0 | 0 | 55 | 55 | 55 | 55 | 0 | Unchanged. |
| Lead Intelligence | 5 | 0 | 0 | 45 | 45 | 45 | 45 | 0 | Unchanged. |
| Tasks | 0 | 5 | 5 | 60 | 60 | 60 | 60 | 0 | Unchanged. |
| Projects | 0 | 0 | 0 | 45 | 45 | 45 | 45 | 0 | Unchanged. |
| Calendar | 0 | 0 | 0 | 45 | 45 | 45 | 45 | 0 | Unchanged. |
| Meeting Notes | 0 | 0 | 0 | 50 | 50 | 50 | 50 | 0 | Unchanged. |
| Health Monitor | 10 | 15 | 40 | 40 | 40 | 40 | 42 | +2 | Still honestly offline. Every connector and every MCP row now prints *never probed* rather than leaving the column blank. |
| Integration Registry | 0 | 45 | 50 | 50 | 55 | 55 | 62 | +7 | 29 connectors, state and category filters composing in the URL, an empty result that names both filters, the probe date on every row, and the MCP panel as a second lens on the same table. No secret on either surface. |
| Weekly Review | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Not built and not registered. Wave 7+. |

Negative deltas in the Wave 1 column were deliberate: a nav label with nothing
behind it scored points in the baseline for fake inventory. Removing it was
progress.

No Wave 6 surface scores above 55, and the two measurement surfaces score 50.
That is the ceiling for a fabric with no scheduler, no connector runtime, and no
finance system behind it: Automations can prepare and gate work but cannot
deliver it, and Analytics counts writes to this browser rather than usage of the
product. A higher score in either would require a credential this bundle cannot
hold or an observer this platform deliberately does not ship.

## Platform aggregate

| Measure | Wave 0 | Wave 1 | Wave 2 | Wave 3 | Wave 4 | Wave 5 | Wave 6 |
|---------|-------:|-------:|-------:|-------:|-------:|-------:|-------:|
| Weighted platform completion | ~8–12% | ~20% | ~28% | ~44% | ~52% | ~60% | ~67% |
| Production readiness score | 12 / 100 | 34 / 100 | 42 / 100 | 50 / 100 | 55 / 100 | 60 / 100 | 64 / 100 |
| Enabled modules | 0 | 3 | 6 | 12 | 13 | 20 | 24 |
| Nested sub-routes | 0 | 0 | 0 | 0 | 5 | 5 | 6 |
| Record detail routes | 0 | 0 | 0 | 3 | 4 | 7 | 9 |
| Tests | 0 | 46 | 114 | 281 | 396 | 612 | 853 |

The Wave 4 test figure is the one recorded at the gate; the M1 fix pack took it
to 409 before Wave 5 began, and the H1 fix pack took Wave 5 to 644 before Wave 6
began.

Wave 6 readiness gains: a rule fabric whose only actions are local, whose
hand-off action always refuses, and whose every run is recorded including the
ones that did nothing (+2); an approval path shared with the human queue rather
than a second gate of its own (+1); and two measurement surfaces that print the
basis and sample size under every number and refuse a rate when the denominator
is zero (+1). Still zero for auth, remote persistence, and health probes — those
remain the caps on this score, not UI surface area. Nothing in this wave moved
the platform closer to acting on the operator's behalf outside this browser, and
that was the design.

Update this file each wave.

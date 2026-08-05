# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 2 (Attention OS). Baseline column is the Wave 0 audit.

| Module | Baseline % | Wave 1 % | Wave 2 % | Δ (W1→W2) | Notes |
|--------|-----------:|---------:|---------:|----------:|-------|
| Executive Dashboard / Morning Brief | 5 | 55 | 65 | +10 | Attention section now links into the inbox, queue, and health surfaces; decided gates leave it; truncation is stated rather than hidden. |
| Notifications | 0 | 5 | 55 | +50 | `/inbox` lists, filters on read state and severity, and writes read state through to Dexie. No emitters yet. |
| Approval Queue | 10 | 10 | 55 | +45 | `/approvals` ranks open gates by risk and due date; approve, reject, and reopen persist and are recorded as activity. No policy engine. |
| Health Monitor | 10 | 15 | 40 | +25 | `/health` projects the Integration Registry — substrate state, category counts, blocked capabilities. Still zero probes, so still honestly offline. |
| System Logs | 0 | 0 | 20 | +20 | Recorded-events panel inside Health, sourced from the local activity log. No telemetry pipeline. |
| Command Palette | 0 | 60 | 70 | +10 | New `Act` group with the first mutating command; route parity with the router is test-enforced. |
| Search | 0 | 55 | 60 | +5 | Approvals indexed as their own kind; signals and gates route to their real modules. |
| MCP Connections | 0 | 30 | 30 | 0 | Registry entries with honest states. No gateway, no servers. |
| Settings | 0 | 30 | 30 | 0 | Local store controls, credential reality, kernel status, unbuilt-module roadmap. |
| Analytics | 5 | 5 | 5 | 0 | Leverage metrics still live in the brief only. Dedicated module is Wave 6. |
| Business Metrics | 5 | 5 | 5 | 0 | Same as above. |
| Mission Control | 5 | 5 | 5 | 0 | Blocked missions surface in the brief. Module is Wave 3. |
| Revenue Pipeline | 0 | 5 | 5 | 0 | Entity and stages modelled; opportunities rank in the brief. No module. |
| CRM | 0 | 5 | 5 | 0 | `Person` / `Company` entities modelled and searchable. No module. |
| Tasks | 0 | 5 | 5 | 0 | `Task` entity with blocked reasons; drives three brief sections. No module. |
| Content Engine | 5 | 5 | 5 | 0 | `ContentItem` entity only. Real engine still in ContentDone. |
| AI Workspace | 0 | 5 | 5 | 0 | Kernel interface plus refusing stub. No workspace, no live calls. |
| Daily Brief | 0 | 55 | 65 | +10 | Delivered as the Morning Brief route. |
| Prompt Library | 0 | 0 | 0 | 0 | Wave 5. |
| Opportunity Tracker | 0 | 0 | 0 | 0 | Wave 3. |
| Projects | 0 | 0 | 0 | 0 | Wave 3. |
| Knowledge Base | 0 | 0 | 0 | 0 | Wave 5. |
| Memory | 0 | 0 | 0 | 0 | Wave 5. |
| Weekly Review | 0 | 0 | 0 | 0 | Wave 6. |
| Calendar | 0 | 0 | 0 | 0 | Wave 3. |
| Research | 0 | 0 | 0 | 0 | Wave 5. |
| Automation Center | 5 | 0 | 0 | 0 | Hidden until built (Wave 6). |
| Documents | 0 | 0 | 0 | 0 | Wave 5. |
| Meeting Notes | 0 | 0 | 0 | 0 | Wave 3. |
| Financial KPIs | 0 | 0 | 0 | 0 | Wave 6. |
| Lead Intelligence | 5 | 0 | 0 | 0 | Real work is Wave 3. |
| Idea Vault | 0 | 0 | 0 | 0 | Wave 4. |
| Content Calendar | 0 | 0 | 0 | 0 | Wave 4; exists in ContentDone. |
| Relationship Intelligence | 0 | 0 | 0 | 0 | Wave 3. |
| Decision Log | 0 | 0 | 0 | 0 | Wave 5. Approval decisions are recorded as activity events, but the module is not built. |

Negative deltas in the Wave 1 column were deliberate: a nav label with nothing
behind it scored points in the baseline for fake inventory. Removing it was
progress.

## Platform aggregate

| Measure | Wave 0 | Wave 1 | Wave 2 |
|---------|-------:|-------:|-------:|
| Weighted platform completion | ~8–12% | ~20% | ~28% |
| Production readiness score | 12 / 100 | 34 / 100 | 42 / 100 |
| Enabled modules | 0 | 3 | 6 |
| Tests | 0 | 46 | 100 |

Wave 2 readiness gains: a typed and tested write path with durable operator
intent (+4), three honest attention surfaces (+3), and a health projection that
still refuses to fabricate a green light (+1). Still zero for auth, remote
persistence, health probes, and agent runtime — those are the caps on this score,
not UI polish.

Update this file each wave.

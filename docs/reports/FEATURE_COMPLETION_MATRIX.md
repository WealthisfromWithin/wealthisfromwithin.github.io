# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 1 (foundation shell). Baseline column is the Wave 0 audit.

| Module | Baseline % | Wave 1 % | Δ | Notes |
|--------|-----------:|---------:|---:|-------|
| Executive Dashboard / Morning Brief | 5 | 55 | +50 | Six questions answered from the local Dexie store; pure selectors, unit-tested. No remote data. |
| Command Palette | 0 | 60 | +60 | `⌘K` / `Ctrl+K`, fuzzy over commands and records, navigation to enabled modules only. |
| Search | 0 | 55 | +55 | `/` opens global search across eight record kinds. No recent/pinned yet. |
| MCP Connections | 0 | 30 | +30 | Registry entries with honest states. No gateway, no servers. |
| Settings | 0 | 30 | +30 | Local store controls, credential reality, kernel status, unbuilt-module roadmap. |
| Health Monitor | 10 | 15 | +5 | Fake Substrate cards deleted. Health now derives from registry truth and correctly reports offline. No probes. |
| Analytics | 5 | 5 | 0 | Fake KPI widgets removed from the shipped surface; leverage metrics moved into the brief as badged demo rows. |
| Business Metrics | 5 | 5 | 0 | Same as above. Dedicated module is Wave 6. |
| Approval Queue | 10 | 10 | 0 | Fake critical queue removed; approvals now appear as badged demo rows in the brief. Module is Wave 2. |
| Mission Control | 5 | 5 | 0 | Fake mission cards removed; blocked missions surface in the brief. Module is Wave 3. |
| Notifications | 0 | 5 | +5 | Entity, seed, and brief surfacing exist. Inbox module is Wave 2. |
| Revenue Pipeline | 0 | 5 | +5 | `Opportunity` entity and pipeline stages modelled; opportunities rank in the brief. No module. |
| CRM | 0 | 5 | +5 | `Person` / `Company` entities modelled and searchable. No module. |
| Tasks | 0 | 5 | +5 | `Task` entity with blocked reasons; drives three brief sections. No module. |
| Content Engine | 5 | 5 | 0 | `ContentItem` entity only. Real engine still in ContentDone. |
| AI Workspace | 0 | 5 | +5 | Kernel interface plus refusing stub. No workspace, no live calls. |
| Prompt Library | 0 | 0 | 0 | Wave 5. |
| Opportunity Tracker | 0 | 0 | 0 | Wave 3. |
| Projects | 0 | 0 | 0 | Wave 3. |
| Knowledge Base | 0 | 0 | 0 | Wave 5. |
| Memory | 0 | 0 | 0 | Wave 5. |
| Daily Brief | 0 | 55 | +55 | Delivered as the Morning Brief route. |
| Weekly Review | 0 | 0 | 0 | Wave 6. |
| Calendar | 0 | 0 | 0 | Wave 3. |
| Research | 0 | 0 | 0 | Wave 5. |
| Automation Center | 5 | 0 | −5 | Nav-only label removed. Hidden until built (Wave 6). |
| System Logs | 0 | 0 | 0 | Wave 2 with the Health Monitor. |
| Documents | 0 | 0 | 0 | Wave 5. |
| Meeting Notes | 0 | 0 | 0 | Wave 3. |
| Financial KPIs | 0 | 0 | 0 | Wave 6. |
| Lead Intelligence | 5 | 0 | −5 | Substrate chip removed. Real work is Wave 3. |
| Idea Vault | 0 | 0 | 0 | Wave 4. |
| Content Calendar | 0 | 0 | 0 | Wave 4; exists in ContentDone. |
| Relationship Intelligence | 0 | 0 | 0 | Wave 3. |
| Decision Log | 0 | 0 | 0 | Wave 5. |

Negative deltas are deliberate: a nav label with nothing behind it scored points
in the baseline for fake inventory. Removing it is progress.

## Platform aggregate

| Measure | Wave 0 | Wave 1 |
|---------|-------:|-------:|
| Weighted platform completion | ~8–12% | ~20% |
| Production readiness score | 12 / 100 | 34 / 100 |

Readiness gains: real source tree and module boundaries (+8), typed domain and
local store (+5), lint/types/tests/CI (+5), honest integration and health model
(+3), palette and search (+2), PWA and SPA deep-link fallback preserved (+1).
Still zero for auth, remote persistence, health probes, and agent runtime.

Update this file each wave.

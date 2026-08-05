# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 4 (Content Operating System). Baseline column is the Wave 0 audit.

| Module | Baseline % | Wave 1 % | Wave 2 % | Wave 3 % | Wave 4 % | Δ (W3→W4) | Notes |
|--------|-----------:|---------:|---------:|---------:|---------:|----------:|-------|
| Content Engine | 5 | 5 | 5 | 5 | 60 | +55 | `/content` production queue over the full status machine, with the three guarded moves behind their own writers. No editor, no publishing connector. |
| Idea Vault | 0 | 0 | 0 | 0 | 55 | +55 | `/content/ideas` captures, parks, and promotes to a linked draft, ranked by reach × confidence ÷ effort with the inputs printed. Re-scoring is deferred. |
| Content Calendar | 0 | 0 | 0 | 0 | 50 | +50 | `/content/calendar` by publish date with the undated listed separately. A date is an intention, not a queued job. |
| Content Analytics | 0 | 0 | 0 | 0 | 45 | +45 | `/content/analytics` sums recorded readings by platform, format, and hook style. No analytics connector; unmeasured items show no performance rather than a zero. |
| Performance Learning | 0 | 0 | 0 | 0 | 40 | +40 | Insights derived from readings, each printing its sample size, plus a 30-day-against-30-day window. Refuses to compare when only one group carries data. |
| Campaign Management | 0 | 0 | 0 | 0 | 40 | +40 | `/content/campaigns` rolls up the items and ideas pointing at each campaign. Counts are counted, never stored on the campaign. |
| Content Libraries (hooks, CTAs, assets, templates) | 0 | 0 | 0 | 0 | 40 | +40 | One route, `?type=`, with usage counted through platform variants. Metadata only — assets are described, not stored. |
| Repurposing | 0 | 0 | 0 | 0 | 35 | +35 | `parentId` links a cut to its source, rendered from both ends on the package. No generation. |
| Video Tracking | 0 | 0 | 0 | 0 | 35 | +35 | Script, duration, and status on video and short items, filtered from the queue rather than given a route. |
| Compliance Check | 0 | 0 | 0 | 0 | 30 | +30 | Local keyword policy before approve, blocking on `critical`, override recorded on the item and in the event log. Not a compliance review, and the panel says so. |
| Approval Queue | 10 | 10 | 55 | 55 | 60 | +5 | Content submitted for review opens a real gate here, and approving the package closes it. |
| Executive Dashboard / Morning Brief | 5 | 55 | 65 | 75 | 80 | +5 | Content due today, content awaiting a gate (de-duplicated against the generic approval row), blocked packages, and the top learning insight leading leverage. |
| Daily Brief | 0 | 55 | 65 | 75 | 80 | +5 | Delivered as the Morning Brief route. |
| Command Palette | 0 | 60 | 70 | 80 | 85 | +5 | Four content actions; parity tests now include sub-routes. |
| Search | 0 | 55 | 60 | 75 | 82 | +7 | Ideas, campaigns, hooks, CTAs, assets, and templates indexed alongside content items. |
| Notifications | 0 | 5 | 55 | 55 | 60 | +5 | Content review and content-due signals, seeded and raised on submission, inheriting item provenance. |
| System Logs | 0 | 0 | 20 | 25 | 30 | +5 | Content status, capture, and promotion events flow into the recorded-events panel on the existing `content` channel. |
| CRM | 0 | 5 | 5 | 60 | 60 | 0 | Unchanged. |
| Relationship Intelligence | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. |
| Revenue Pipeline | 0 | 5 | 5 | 60 | 60 | 0 | Unchanged. |
| Opportunity Tracker | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. |
| Lead Intelligence | 5 | 0 | 0 | 45 | 45 | 0 | Unchanged. |
| Tasks | 0 | 5 | 5 | 60 | 60 | 0 | Unchanged. |
| Projects | 0 | 0 | 0 | 45 | 45 | 0 | Unchanged. |
| Calendar | 0 | 0 | 0 | 45 | 45 | 0 | Unchanged. The publishing calendar is a separate surface; content carries a publish date, not a due date. |
| Meeting Notes | 0 | 0 | 0 | 50 | 50 | 0 | Unchanged. |
| Health Monitor | 10 | 15 | 40 | 40 | 40 | 0 | Unchanged and still honestly offline. LinkedIn, Facebook, and the publishing webhook stay `awaiting_credentials`. |
| MCP Connections | 0 | 30 | 30 | 30 | 30 | 0 | Registry entries with honest states. No gateway. |
| Settings | 0 | 30 | 30 | 30 | 30 | 0 | Roadmap list shrank by one as Content OS shipped. |
| Mission Control | 5 | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| Analytics | 5 | 5 | 5 | 5 | 5 | 0 | Wave 6. The content learning surface is content-scoped, not the platform analytics module. |
| Business Metrics | 5 | 5 | 5 | 5 | 5 | 0 | Wave 6. |
| AI Workspace | 0 | 5 | 5 | 5 | 5 | 0 | Kernel interface plus refusing stub. Wave 5. |
| Prompt Library | 0 | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Knowledge Base | 0 | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Memory | 0 | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Weekly Review | 0 | 0 | 0 | 0 | 0 | 0 | Wave 6. |
| Research | 0 | 0 | 0 | 0 | 0 | 0 | Wave 5. |
| Automation Center | 5 | 0 | 0 | 0 | 0 | 0 | Hidden until built (Wave 6). |
| Documents | 0 | 0 | 0 | 0 | 0 | 0 | Wave 5. Content assets are described in the library, not stored. |
| Financial KPIs | 0 | 0 | 0 | 0 | 0 | 0 | Wave 6. |
| Decision Log | 0 | 0 | 0 | 0 | 0 | 0 | Wave 5. Content events are recorded as activity, but the module is not built. |

Negative deltas in the Wave 1 column were deliberate: a nav label with nothing
behind it scored points in the baseline for fake inventory. Removing it was
progress.

No Wave 4 surface scores above 60, and the publishing-adjacent ones sit lower on
purpose. The Content OS can plan, gate, schedule, record, and learn; it cannot
publish, and no score here should imply otherwise.

## Platform aggregate

| Measure | Wave 0 | Wave 1 | Wave 2 | Wave 3 | Wave 4 |
|---------|-------:|-------:|-------:|-------:|-------:|
| Weighted platform completion | ~8–12% | ~20% | ~28% | ~44% | ~52% |
| Production readiness score | 12 / 100 | 34 / 100 | 42 / 100 | 50 / 100 | 55 / 100 |
| Enabled modules | 0 | 3 | 6 | 12 | 13 |
| Nested sub-routes | 0 | 0 | 0 | 0 | 5 |
| Record detail routes | 0 | 0 | 0 | 3 | 4 |
| Tests | 0 | 46 | 114 | 281 | 396 |

Wave 4 readiness gains: a complete content production loop whose every write is
gated by an explicit status machine (+2), a compliance check that refuses an
approval and records an override rather than hiding either (+1), publishing
honesty enforced in the UI, the integration panel, and the event log (+1), and a
href allowlist hardened against traversal that collapses into an allowed path
(+1). Still zero for auth, remote persistence, health probes, and agent runtime
— those remain the caps on this score, not UI surface area.

Update this file each wave.

# Feature Completion Matrix

See also `ARCHITECTURE_AUDIT.md` §9. Scores are Command Center surface
completion, not sister-repo capability.

**Last updated:** Wave 7 (Production Hardening). Baseline column is the Wave 0
audit.

| Module | Base | W1 | W2 | W3 | W4 | W5 | W6 | W7 | Δ | Notes |
|--------|-----:|---:|---:|---:|---:|---:|---:|---:|--:|-------|
| Command API Sync | 0 | 0 | 0 | 0 | 0 | 0 | 0 | **30** | **+30** | `/sync` routed: three honest states, a real `GET /health` probe behind a build-time base URL that is refused if it carries userinfo, a query, a fragment, or plaintext on a public host, and the result written to the registry with its timestamp. Capped at 30 because exactly one of six capabilities is implemented — no read-model, no write-through, no conflict policy, no session, no vault — and each absence is printed on the page |
| Integration Registry | 0 | 45 | 50 | 50 | 55 | 55 | 62 | **70** | **+8** | `connected` is now enforced rather than described: `recordIntegrationProbe` refuses an undated result, and `effectiveIntegrationState` downgrades any unevidenced claim at every read. One row can finally be probed for real. Still 29 connectors with no secret on any surface |
| Health Monitor | 10 | 15 | 40 | 40 | 40 | 40 | 42 | **48** | **+6** | Still honestly offline, but no longer *structurally* incapable of anything else: `verifiedIntegrations` reads through `isUsable`, blocked capabilities read through the effective state, and "N of M substrate systems verified" becomes true the moment a probe succeeds rather than remaining decorative |
| Settings | 0 | 30 | 30 | 30 | 30 | 35 | 38 | **46** | **+8** | A mode panel states plainly which mode the build is in, where records live, how many rows are demo, and what an API base URL does and does not change. The roadmap list is empty for the first time and says so instead of rendering a blank panel |
| Executive Dashboard / Morning Brief | 5 | 55 | 65 | 75 | 80 | 85 | 88 | 88 | 0 | Unchanged |
| Daily Brief | 0 | 55 | 65 | 75 | 80 | 85 | 88 | 88 | 0 | Delivered as the Morning Brief route |
| Command Palette | 0 | 60 | 70 | 80 | 85 | 90 | 94 | **95** | **+1** | A sync surface entry, with the parity tests still requiring every target to resolve to a served route and pass `isSafeInternalHref` |
| Search | 0 | 55 | 60 | 75 | 82 | 88 | 90 | **91** | **+1** | Integration hits carry the effective state in their subtitle, and the Command API row routes to `/sync` rather than the full registry |
| MCP Connections | 0 | 30 | 30 | 30 | 30 | 30 | 45 | **47** | **+2** | The panel reads the same effective state as everywhere else, so an unevidenced Connected cannot appear here either. Still no client, no transport, no tool enumeration |
| Approval Queue | 10 | 10 | 55 | 55 | 60 | 60 | 65 | 65 | 0 | Unchanged. The W4 M1 content branch and the W6 automation branch both still pass unmodified |
| Automation Center | 5 | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 0 | Unchanged. The `handoff` action still always refuses; a probe is not a credential |
| Mission Control | 5 | 5 | 5 | 5 | 5 | 5 | 55 | 55 | 0 | Unchanged |
| Business Metrics | 5 | 5 | 5 | 5 | 5 | 5 | 50 | 50 | 0 | Unchanged. The W6 M1 window fix is still green |
| Analytics | 5 | 5 | 5 | 5 | 5 | 5 | 50 | 50 | 0 | Unchanged |
| Financial KPIs | 0 | 0 | 0 | 0 | 0 | 0 | 45 | 45 | 0 | Unchanged |
| Notifications | 0 | 5 | 55 | 55 | 60 | 62 | 65 | 65 | 0 | Unchanged |
| System Logs | 0 | 0 | 20 | 25 | 30 | 35 | 38 | **40** | **+2** | Probe results append to the same recorded activity log, so a verified or failed probe is auditable rather than only visible on `/sync` |
| Content Analytics | 0 | 0 | 0 | 0 | 45 | 45 | 47 | 47 | 0 | Unchanged |
| Revenue Pipeline | 0 | 5 | 5 | 60 | 60 | 60 | 62 | 62 | 0 | Unchanged |
| Knowledge Base | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 55 | 0 | Unchanged |
| Memory | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 55 | 0 | Unchanged |
| Decision Log | 0 | 0 | 0 | 0 | 0 | 55 | 55 | 55 | 0 | Unchanged |
| Prompt Library | 0 | 0 | 0 | 0 | 0 | 50 | 50 | 50 | 0 | Unchanged |
| Documents | 0 | 0 | 0 | 0 | 0 | 45 | 45 | 45 | 0 | Unchanged |
| Research | 0 | 0 | 0 | 0 | 0 | 45 | 45 | 45 | 0 | Unchanged |
| AI Workspace | 0 | 5 | 5 | 5 | 5 | 35 | 35 | 35 | 0 | Unchanged. A Command API base URL does not configure a model; the four hosted adapters still refuse |
| Content Engine | 5 | 5 | 5 | 5 | 60 | 60 | 60 | 60 | 0 | Unchanged |
| Idea Vault | 0 | 0 | 0 | 0 | 55 | 55 | 55 | 55 | 0 | Unchanged |
| Content Calendar | 0 | 0 | 0 | 0 | 50 | 50 | 50 | 50 | 0 | Unchanged |
| Performance Learning | 0 | 0 | 0 | 0 | 40 | 40 | 40 | 40 | 0 | Unchanged |
| Campaign Management | 0 | 0 | 0 | 0 | 40 | 40 | 40 | 40 | 0 | Unchanged |
| Content Libraries | 0 | 0 | 0 | 0 | 40 | 40 | 40 | 40 | 0 | Unchanged |
| Repurposing | 0 | 0 | 0 | 0 | 35 | 35 | 35 | 35 | 0 | Unchanged |
| Video Tracking | 0 | 0 | 0 | 0 | 35 | 35 | 35 | 35 | 0 | Unchanged |
| Compliance Check | 0 | 0 | 0 | 0 | 30 | 30 | 30 | 30 | 0 | Unchanged |
| CRM | 0 | 5 | 5 | 60 | 60 | 60 | 60 | 60 | 0 | Unchanged |
| Relationship Intelligence | 0 | 0 | 0 | 55 | 55 | 55 | 55 | 55 | 0 | Unchanged |
| Opportunity Tracker | 0 | 0 | 0 | 55 | 55 | 55 | 55 | 55 | 0 | Unchanged |
| Lead Intelligence | 5 | 0 | 0 | 45 | 45 | 45 | 45 | 45 | 0 | Unchanged |
| Tasks | 0 | 5 | 5 | 60 | 60 | 60 | 60 | 60 | 0 | Unchanged |
| Projects | 0 | 0 | 0 | 45 | 45 | 45 | 45 | 45 | 0 | Unchanged |
| Calendar | 0 | 0 | 0 | 45 | 45 | 45 | 45 | 45 | 0 | Unchanged |
| Meeting Notes | 0 | 0 | 0 | 50 | 50 | 50 | 50 | 50 | 0 | Unchanged |
| Weekly Review | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | 0 | Still not built and not registered. It is now the only named module in the audit with no entry in the registry at all |

Negative deltas in the Wave 1 column were deliberate: a nav label with nothing
behind it scored points in the baseline for fake inventory. Removing it was
progress.

Wave 7 moved eight rows and left thirty-six untouched, which is the correct
shape for a hardening wave. Every gain is in the *substrate* group — sync,
registry, health, settings, logs — and the highest new score on the board is 70.
The ceiling is the same one it has always been: no credential can live in a
static bundle, so a connector cannot be genuinely connected, a model cannot be
hosted, and content cannot be published from here.

**`/sync` scores 30, and that number is deliberately low for a module that
works.** It does the one thing it claims completely and correctly, and that one
thing is a sixth of what a sync module is. Scoring it higher because the code is
good would be scoring the implementation instead of the capability.

## Platform aggregate

| Measure | W0 | W1 | W2 | W3 | W4 | W5 | W6 | W7 |
|---------|---:|---:|---:|---:|---:|---:|---:|---:|
| Weighted platform completion | ~8–12% | ~20% | ~28% | ~44% | ~52% | ~60% | ~67% | **~69%** |
| Production readiness (reconciled) | 12 | — | — | — | — | — | 71 | **78** |
| Enabled modules | 0 | 3 | 6 | 12 | 13 | 20 | 24 | **25** |
| Nested sub-routes | 0 | 0 | 0 | 0 | 5 | 5 | 6 | 6 |
| Record detail routes | 0 | 0 | 0 | 3 | 4 | 7 | 9 | 9 |
| Tests | 0 | 46 | 114 | 281 | 396 | 612 | 856 | **919** |
| Test files | 0 | — | — | 26 | — | 49 | 64 | **68** |
| First-load JS (gzip) | — | — | ~163 kB | ~168 kB | ~182 kB | ~200 kB | ~210 kB | **~196 kB** |

The Wave 4 test figure is the one recorded at the gate; the M1 fix pack took it
to 409 before Wave 5 began, the H1 fix pack took Wave 5 to 644 before Wave 6
began, and the W6 M1 fix pack took Wave 6 to 857 before Wave 7 began.

**The readiness row changed basis in Wave 7.** Two divergent series had been
running in this file and in `PRODUCTION_READINESS.md`, fourteen points apart by
Wave 6. Both are retired in favour of a per-category table that sums to its own
total; Wave 6 rescored on that basis is 71. See
[`PRODUCTION_READINESS.md`](./PRODUCTION_READINESS.md) for the working. Earlier
waves are left blank rather than back-fitted, because rescoring a wave nobody
can re-measure would be inventing history.

The gzip row is the first wave in which it went **down**. Deferring the demo
seed and splitting three vendor chunks took 52.75 kB raw and 14.56 kB gzip off
the first load while adding a module — the first time route splitting has
outrun the growth it was compensating for.

Update this file each wave.

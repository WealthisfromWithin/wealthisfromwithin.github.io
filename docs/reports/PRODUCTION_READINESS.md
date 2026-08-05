# Production Readiness Score (Baseline)

**Score: 12 / 100**

| Category | Max | Score | Rationale |
|----------|-----|-------|-----------|
| Architecture clarity | 10 | 8 | Audit complete; code not yet aligned |
| Working application | 15 | 1 | Poster only |
| Data integrity | 10 | 1 | No store; fake UI numbers |
| Integrations honesty | 10 | 2 | Pattern exists in ContentDone, not here |
| Auth & security | 10 | 1 | Static public site only |
| AI kernel | 10 | 1 | Stub elsewhere |
| Content OS | 10 | 2 | Partial in ContentDone |
| UX completeness | 10 | 3 | Strong brand, zero interaction depth |
| Quality gates (CI/tests) | 10 | 0 | Absent |
| Docs / ops | 5 | 3 | This audit pack |

**Target after Wave 1:** ~28–35  
**Target after Wave 4:** ~55–65  
**Target for “business OS” claim:** ≥ 85 with auth + live integrations + Brief on real data


---

## Wave 1 update (Architect)

**Score: 32 / 100** (was 12)

| Category | Max | Wave 0 | Wave 1 |
|----------|-----|--------|--------|
| Architecture clarity | 10 | 8 | 9 |
| Working application | 15 | 1 | 8 |
| Data integrity | 10 | 1 | 5 |
| Integrations honesty | 10 | 2 | 7 |
| Auth & security | 10 | 1 | 2 |
| AI kernel | 10 | 1 | 3 |
| Content OS | 10 | 2 | 2 |
| UX completeness | 10 | 3 | 6 |
| Quality gates | 10 | 0 | 6 |
| Docs / ops | 5 | 3 | 4 |

Still demo-local; private data, API sync, and Content OS absorption remain ahead.


---

## Wave 2 update (Architect)

**Score: 42 / 100** (was 32 after Wave 1)

Attention loop is real: Inbox, Approvals, Health, Brief. Still local-demo; CRM/Content/API ahead.


---

## Wave 3 update (Implementer — proposed, pending G3)

**Score: 50 / 100** (was 42 after Wave 2)

Revenue and relationship motion is operable: CRM, Pipeline, Tasks, Projects,
Calendar, and Meetings, plus three record detail routes. Gains are in *working
application* (twelve enabled modules), *data integrity* (every displayed figure
is arithmetic over a stored field, and five new mutations all stamp `touchedAt`),
*quality gates* (281 tests across 26 files, including component clicks and real
router mounts against a real IndexedDB), and one point of *auth & security* for extending the href
allowlist to dynamic record ids.

Caps are unchanged: no auth, no remote persistence, no health probes, no agent
runtime, no Content OS. Adding modules cannot move those, and this number should
not be read as progress toward them.

Category subtotals in the Wave 1 table above do not sum to its stated total; the
per-category breakdown has not been reconciled since Wave 0, so treat the headline
scores as the authoritative series.


---

## Wave 4 update (Architect)

**Score: 65 / 100** (was 55 after Wave 3)

Content OS live with compliance-aware approvals (M1 fixed). Cognition / automations / API sync still ahead.


---

## Wave 5 update (Architect)

**Score: 72 / 100** (was 65 after Wave 4)

Cognition modules + Agent Kernel live; local AI loopback-only (H1 fixed). Automations/MCP/API sync still ahead.


---

## Wave 6 update (Architect)

**Score: 78 / 100** (was 72 after Wave 5)

Automations, missions, metrics, analytics, MCP panel live. Sync/auth still ahead for ≥85.


---

## Wave 7 update (Implementer — proposed)

**Score: 78 / 100 on a reconciled scale.** Read the reconciliation below before
comparing this to any earlier number; the headline is unchanged from Wave 6 but
the basis is not.

### First, the discrepancy

Two documents in this repository have been keeping two different readiness
series, and they diverged from Wave 4 onward:

| | W0 | W1 | W2 | W3 | W4 | W5 | W6 |
|---|---:|---:|---:|---:|---:|---:|---:|
| This file (headline) | 12 | 32 | 42 | 50 | 65 | 72 | 78 |
| `FEATURE_COMPLETION_MATRIX.md` | 12 | 34 | 42 | 50 | 55 | 60 | 64 |

A fourteen-point gap between two documents describing the same platform is the
kind of thing this project exists to refuse elsewhere, so it is fixed here
rather than carried forward. The Wave 3 note already flagged that the
per-category table had not been reconciled since Wave 0 and asked readers to
treat the headline as authoritative. That was the wrong call: an unreconciled
headline is a number with no working, and this file had two of them.

**Both series are retired.** What follows is a per-category table that sums to
its own total, with Wave 6 rescored on the same basis so the delta means
something. On that basis Wave 6 was **71**, and Wave 7 is **78** — a genuine
+7, not a coincidence with the old headline.

### Wave 7 score

| Category | Max | W6 (rescored) | W7 | What moved |
|----------|----:|--------------:|---:|------------|
| Architecture clarity | 10 | 9 | **10** | The seven Phase 17 documents exist and describe the running system, closing the last item of §10 "What Done Means" |
| Working application | 15 | 13 | 13 | `/sync` is a 25th routed module, but an adapter with one probe is not a new capability class |
| Data integrity | 10 | 8 | 8 | Unchanged. One write path, transactions, provenance, tested migrations — and still no backup, export, or second device |
| Integrations honesty | 10 | 7 | **9** | The connected-probe invariant is enforced on write *and* read, and one row can now be probed for real |
| Auth & security | 10 | 2 | **4** | CSP shipped on the built index; both URL adapters refuse credentials and downgrades before sending. Still zero authentication |
| AI kernel | 10 | 6 | 6 | Unchanged |
| Content OS | 10 | 6 | 6 | Unchanged |
| UX completeness | 10 | 8 | 8 | The mode panel and the honest empty roadmap are clarity, not new surface |
| Quality gates | 10 | 8 | **9** | 919 tests across 68 files, including suites that assert architectural rules rather than features |
| Docs / ops | 5 | 4 | **5** | Phase 17 complete, with runbooks and an honest security posture |
| **Total** | **100** | **71** | **78** | |

### Why each gain, and why it stopped where it did

**Architecture clarity 9 → 10.** `SYSTEM_ARCHITECTURE`, `DATABASE`, `API`,
`MCP`, `DEPLOYMENT`, `OPERATIONS`, and `DEVELOPER_GUIDE` are written against
measured facts — 30 stores, six migrations, 50 writers, two outbound `fetch`
calls, 639.46 kB first load. Full marks because the documentation now matches
the system, which was the actual criterion, not because documentation could not
be better.

**Integrations honesty 7 → 9.** `connected` was defined as "credentials verified
by a health probe" since Wave 1 and enforced by nothing, because nothing could
write the state. Now `recordIntegrationProbe` refuses a result with no parseable
timestamp, and `effectiveIntegrationState` downgrades any unevidenced claim at
every read — registry, MCP panel, Health Monitor, search index, state counts.
**Not 10**, because 28 of 29 connectors still have no probe path that could ever
run from this bundle, so their states remain declarations.

**Auth & security 2 → 4.** Control 4 of the ten mandatory controls in
`SECURITY_REPORT.md` is shipped: a CSP with `script-src 'self'`, `object-src
'none'`, `form-action 'none'`, and `connect-src 'self'` in the public build.
Both URL-taking adapters refuse userinfo, query strings, fragments, and
non-loopback plaintext before a request is built. **Not higher**, because there
is still no authentication, no authorisation, no encryption at rest, no rate
limiting, and `frame-ancestors` cannot be delivered from Pages at all — meaning
clickjacking protection is absent rather than partial.

**Quality gates 8 → 9.** +62 tests, and the ones that matter most assert rules:
the probe writer refuses an undated result, the meta CSP omits the directive
browsers ignore, the module registry keeps `wave > 7` unrouted, every palette
target resolves. **Not 10**, because there is no coverage measurement, no
end-to-end suite against a real browser, and no performance budget enforced in
CI.

**Docs / ops 4 → 5.** Phase 17 complete, plus runbooks for the failures that can
actually occur and an explicit statement of what is not monitored and why.

### What the remaining 22 points are

They are not UI surface area, and adding modules will not move them.

| Gap | Points | Blocked on |
|-----|-------:|-----------|
| Authentication and private mode | ~6 | A Command API that can verify an identity |
| Remote persistence, export, second device | ~4 | The same API, plus conflict policy |
| Live integrations — real probes, real credentials | ~3 | A server-side credential vault |
| Hosted AI providers | ~4 | A server that can hold a key and sign a request |
| Publishing and outbound content | ~3 | n8n or a platform credential, held server-side |
| Coverage, e2e, performance budget | ~2 | Nothing external — this is available work |

Five of the six require the same thing: **a server**. That is the honest shape
of this platform's remaining distance, and it is why the audit's ≥85 threshold
names auth and live integrations specifically.

### The claim this score does not support

Wave 7 is titled *Production Hardening*, and it hardened the build: a policy on
the bundle, an invariant with teeth, a smaller and better-cached first load, and
documentation that matches. **It did not make the platform ready for private
data.** No credential can live here, nothing is backed up, and clearing site data
is still an unrecoverable delete. A score of 78 is a good local-first
single-operator tool with honest instrumentation. It is not a business OS
holding a business's data, and nothing in this wave moved it closer to being
one — by design.


---

## Wave 7 G3 PASS (Architect)

**Score remains 78 / 100** after H1/H2 security fix pack (945 tests).

Probe invariant is structural (domain `isUsable` + source scan). CSP `connect-src` shares adapter acceptance rules. Score does not jump to ≥85 without server auth and live integrations.

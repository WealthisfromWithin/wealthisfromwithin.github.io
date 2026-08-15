# 90-Day Roadmap (Prioritized)

**Architect:** Grok 4.5 · **Implementation:** Claude · **Review:** GPT-5.5
**Last updated:** Wave 7 (Production Hardening).

Calendar dates avoided; sequenced by leverage and dependency. Horizons A–E are
the original plan and are retained with their outcomes marked. Horizons F–H are
what follows Wave 7.

---

## Completed

### Horizon A — Make it real (Waves 1–2) ✅

1. ✅ Accept architecture lock
2. ✅ Scaffold Command Surface; poster retired to `legacy/`
3. ✅ Shell + palette + search + local store
4. ✅ Morning Brief answering six questions
5. ✅ Honest Integration Registry + Health
6. ✅ Approval Queue on the local domain

**Exit met:** the operator can run a daily attention loop without believing lies.

### Horizon B — Money & relationships (Wave 3) ✅

7. ✅ CRM + Relationship Intelligence
8. ✅ Pipeline stages from LeadScheduler doctrine
9. ✅ Opportunities, tasks, projects
10. ✅ Calendar / meetings / notes

**Exit met:** revenue motion is visible in one surface.

### Horizon C — Content OS absorption (Wave 4) ✅

11. ⚠️ ContentDone **domain** absorbed; the **API adapter** is Wave 7 and
    reaches only `/health`
12. ✅ Idea Vault → Queue → Calendar → Analytics
13. ✅ Hook/CTA/Asset libraries + compliance gate
14. ✅ Learning insights in the Brief

**Exit partly met:** ContentDone's *domain* is substrate. Its *data* is not —
nothing is read from or written to it.

### Horizon D — Cognition & leverage (Waves 5–6) ✅

15. ✅ Knowledge / Memory / Decision Log
16. ✅ Agent Kernel + provider adapters
17. ✅ Automations with approval gates
18. ⚠️ MCP **panel** with honest states. **No connectors** — a client needs a
    credential

**Exit met:** AI and automations are centralized and gated.

### Horizon E — Harden (Wave 7) — partial

19. ❌ **Auth + private mode — not delivered.** Impossible on Pages; requires
    the Command API
20. ❌ **Postgres migration path — not started.** Requires the same
21. ✅ Security review pass — CSP shipped, both URL adapters guarded, posture
    documented honestly
22. ✅ Performance pass — first load under the 200 kB gzip target for the first
    time
23. ✅ Phase 17 docs complete. ❌ **Readiness is 78, not ≥ 85**

**Exit not met, and the reason is structural.** Items 19 and 20 both require a
server, and Wave 7's scope was hardening the static surface. The ≥ 85 threshold
was always gated on auth and live integrations; delivering documentation and a
CSP was never going to reach it, and the score says so rather than being
adjusted to fit.

---

## Ahead

Everything below Horizon F is blocked on the same thing, which is why it is one
horizon and not three.

### Horizon F — The Command API (the unblocker)

This is the whole remaining critical path. Six of the seven gaps in
[`REMAINING_ISSUES.md`](./REMAINING_ISSUES.md) §1–2 resolve here and nowhere
else.

24. **Deploy a Command API.** Adapt ContentDone's `/api` rather than write a new
    service — the audit's plan, and the reason the `contentdone` registry row is
    the one `/sync` already probes
25. **Session auth.** `HttpOnly`, `Secure`, `SameSite=Strict` cookies. Never a
    bearer token handed to JavaScript in a public bundle
26. **Private mode in the Command Center.** Sign in, and only then a read-model.
    Demo-local stays the default for an unauthenticated visitor
27. **Server-side credential vault** with `POST /integrations/{id}/probe`
    returning state and timestamp only. This turns 28 registry rows from
    declarations into measurements
28. **CSP as a response header**, including `frame-ancestors` and HSTS. The
    builder already emits the header form; it needs a host that can send it

**Exit:** the platform can hold something private, and `Connected` can mean
something for a connector other than the API itself.

### Horizon G — Sync for real

Only after F. Attempting any of this earlier produces a pending-sync state that
lies.

29. **Read-model.** `GET /records/{collection}?since=` delta reads. Server rows
    arrive as `source: 'remote'` — the value the domain already declares and
    nothing has ever written
30. **Write-through with versions.** Per-record ETags so a conflict is
    detectable rather than a silent last-write-wins
31. **Conflict policy**, decided and documented before the second writer exists
32. **Second device.** The first genuine test of every assumption above

**Exit:** the operator's data survives their browser.

### Horizon H — Leverage that leaves the machine

33. **Hosted AI via `POST /ai/complete`.** The key stays server-side; the kernel
    gains a fifth adapter reporting `external: true`
34. **MCP gateway**, `sovereign-mind-mcp` first — the first-party server that
    needs no vendor credential and proves the pattern
35. **Live n8n hand-off.** The automation `handoff` action stops always refusing
36. **Publishing.** LinkedIn and Facebook through n8n, still gated by the
    existing approval queue

**Exit:** the platform can act outside this browser, with every action still
passing through a human gate.

---

## Available now, blocked on nothing

Worth doing while the API does not exist. None of these need a server, and the
first is the highest-value item on this entire page.

| Item | Why |
|------|-----|
| **JSON export of the local store** | The only self-serve recovery an operator could have. Today, clearing site data is an unrecoverable delete and there is no way to take a copy first |
| **Retention on `events` and `automationRuns`** (TD-20) | Two unbounded tables with no cap, no pruning, and no archive |
| **Coverage measurement in CI** | 919 tests and no idea what they miss |
| **Performance budget in CI** | First-load gzip is measured by hand each wave |
| **Version stamp in the bundle** | A deployed surface cannot currently report which commit it is |
| **TD-24 — filter constants as data** | Shrinks the eager `index` chunk; the largest remaining build win |
| **Weekly Review** | The only audit-named module with no registry entry at all |

---

## Deferred unless leverage is proven

ZoomInfo · HubSpot duplication · ClickUp · Cursor-in-product · speculative MCP
servers · multi-tenancy · real-time collaboration · mobile native.

The nine `disabled` registry rows are disabled for reasons that will still hold
after the credential vault exists. A vault does not make a redundant connector
worth building.

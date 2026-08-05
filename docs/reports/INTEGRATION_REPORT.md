# Integration Report

**Last updated:** Wave 7 (Production Hardening).
**Surfaces:** `/integrations`, `/integrations/mcp`, `/sync`
**Companion:** [`MCP.md`](../MCP.md), [`API.md`](../API.md)

---

## The rule

Every integration is exactly one of **Connected** · **Disabled** · **Awaiting
Credentials**. No ambiguous greens, no "partial", no "degraded".

Since Wave 7 the first of those three has teeth.

## Connected now requires evidence

`connected` has been *defined* as "credentials verified by a health probe" since
Wave 1. Until Wave 7 it was enforced by nothing at all — which was tolerable
only because nothing in the platform could write the state, so the convention
had never been tested.

`/sync` can write it, so it is now enforced on both sides:

| Side | Mechanism |
|------|-----------|
| **Write** | `recordIntegrationProbe` is the only writer that can set `connected`. It refuses a result whose timestamp is missing or unparseable, refuses a row that is deliberately `disabled`, and records `lastProbedAt` on failure as well as success |
| **Read** | `effectiveIntegrationState` downgrades any row claiming `connected` without a probe to `awaiting_credentials`, at every consumer: the registry page, the MCP panel, the Health Monitor (counts *and* substrate pills), the content publishing panel, `countByState`, `isUsable`, `deriveSubstrateHealth`, blocked capabilities, and the search index |
| **Gate** | `automationReadiness` asks `isUsable`, so a rule naming a connector cannot run — and `runAutomation` cannot write — from a row with no probe behind it |

Both halves are load-bearing. The writer governs rows written from now on. The
read-time downgrade governs rows already sitting in an operator's browser — and
IndexedDB is hand-editable from devtools, so a write-side check alone would not
have been an invariant.

The downgrade lives in `src/domain/integrations.ts` — in the domain, because
readiness and action gating are domain decisions and a helper the domain cannot
import is a helper the domain works around. `src/integrations/state.ts`
re-exports it. `src/integrations/invariant.test.ts` scans the source tree and
fails the build if any module outside that one reads `integration.state`
directly, which is how the Wave 7 review found four bypasses that no reviewer
had noticed.

## Current state — 29 connectors

**0 connected · 9 disabled · 20 awaiting credentials.**

| Category | Total | Awaiting | Disabled |
|----------|------:|---------:|---------:|
| AI | 5 | 5 | 0 |
| MCP | 5 | 3 | 2 |
| CRM | 5 | 1 | 4 |
| Productivity | 5 | 3 | 2 |
| Data | 3 | 2 | 1 |
| Automation | 2 | 2 | 0 |
| Publishing | 2 | 2 | 0 |
| Communication | 2 | 2 | 0 |

### Substrate rows

Six rows are marked `substrate` — the systems the platform's own health is
derived from. One (`leadscheduler`) is disabled, so five are eligible, and the
Health Monitor reports:

> No substrate connection is verified. 5 awaiting credentials.

| Substrate row | State | Probe path |
|---------------|-------|-----------|
| `contentdone` — ContentDone API | Awaiting Credentials | **`/sync`, real** — `GET /health` when `VITE_API_BASE_URL` is set |
| `n8n` | Awaiting Credentials | None. Needs a server-held credential |
| `hermes-memory` | Awaiting Credentials | None. Server not built |
| `hermesbrain` | Awaiting Credentials | None. No runtime exists |
| `sovereign-mind-mcp` | Awaiting Credentials | None. Gateway not built |
| `leadscheduler` | Disabled | — |

A successful probe of `contentdone` flips that statement to **"1 of 5 substrate
systems verified"**, and it does so because a measurement changed — not because
a constant did.

## Inventory against reality

The Wave 0 column recorded what existed anywhere in the ecosystem. The Wave 7
column records what this Command Center can do about it.

| Integration | Category | State | Can this bundle reach it? |
|-------------|----------|-------|---------------------------|
| ContentDone API | Automation | Awaiting | **Yes, partially** — `/health` reachability only, when configured. No read, no write |
| Local AI (Ollama) | AI | Awaiting | **Yes** — loopback only, via `/ai`. Not through the registry; the adapter checks its own endpoint |
| n8n | Automation | Awaiting | No — needs a server-held credential. The automation `handoff` action names it and always refuses |
| Calendly | Productivity | Awaiting | No |
| Airtable | Data | Awaiting | No |
| LinkedIn | Publishing | Awaiting | No — publishing is recorded, never performed |
| Facebook | Publishing | Awaiting | No — same |
| CRM Webhook | CRM | Awaiting | No |
| OpenAI · Anthropic · Gemini · OpenRouter | AI | Awaiting | No — adapters exist behind the kernel, refuse every call, and contain no code path that produces text |
| Google Workspace | Productivity | Awaiting | No |
| Notion | Productivity | Awaiting | No |
| GitHub | Data | Awaiting | No |
| SendGrid | Communication | Awaiting | No |
| Slack | Communication | Awaiting | No |
| Hermes Memory · HermesBrain · Sovereign Mind MCP | MCP | Awaiting | No — no MCP client ships |
| ClickUp · Cursor | Productivity | **Disabled** | Decided against |
| Supabase | Data | **Disabled** | Disabled until a remote store is chosen |
| Apollo · ZoomInfo · HubSpot | CRM | **Disabled** | Deferred until lead enrichment demand is proven |
| GitHub MCP · Notion MCP | MCP | **Disabled** | Redundant with existing connectors, or unnecessary while Documents stay local-first |
| LeadScheduler Pro | CRM | **Disabled** | Doctrine absorbed into the domain; the system itself is not called |

**Disabled is a decision, not a failure.** Nine rows are off because the
operation chose against them, and marking them `awaiting_credentials` would
inflate the credential gap and make the platform look more blocked than it is.

## What Wave 7 changed, and what it did not

**Changed:** one connector acquired a genuine probe path, and the meaning of
`connected` became enforceable everywhere.

**Did not change:** 28 of 29 connectors still have no probe path that could ever
run from this bundle. Probing them requires a credential; a static bundle cannot
hold one. Their states remain honest declarations of intent, and the registry
says so on the page.

The count of *verifiable* connectors went from zero to one. That is a small
number and it is stated plainly rather than dressed up, because the value of
this wave was making the state trustworthy rather than making more states.

## No secrets, on any surface

Neither `/integrations`, `/integrations/mcp`, nor `/sync` displays a credential,
a token, an endpoint, or an API key — and none offers a field to type one into.
`/sync` prints only the **host** of a configured base URL, never the full URL,
because a misconfigured value can carry userinfo.

Both URL-taking adapters refuse a credential before sending anything:

| Adapter | Refuses |
|---------|---------|
| Command API | Unparsable URLs; non-HTTPS on public hosts; userinfo; query strings; fragments |
| Local model | Any non-loopback host, LAN and private addresses included |

## ContentDone honesty pattern — kept

`getPublicConfig()` in ContentDone returns booleans for configured connectors
and skips work when URLs are missing, rather than failing at call time. That
pattern was promoted into this registry rather than a second model being
invented, and Wave 7 extends it: the registry now records not just *whether*
something is configured but *when it was last checked*, which is the part a
boolean cannot express.

## MCP topology — target, not current

```
Command API                        ← holds every credential
  └─ McpGateway
       ├─ sovereign-mind-mcp   (this Command Center, as tools)
       ├─ hermes-memory        (durable memory)
       ├─ hermesbrain          (reasoning orchestration)
       └─ vendor adapters      (github, notion, … — only where leverage is proven)
```

**None of this exists.** No MCP client ships in this bundle: no transport, no
handshake, no tool enumeration. See [`MCP.md`](../MCP.md) for the three
independent reasons why, any one of which is sufficient.

## Order of construction

Unchanged from the Wave 0 recommendation, and the dependency chain is why:

1. **Command API with sessions** — nothing below is safe without it
2. **Server-side credential vault** — `POST /integrations/{id}/probe` returning
   state and timestamp only, never the secret. This is what turns 28 of these
   rows from declarations into measurements
3. **n8n and ContentDone first** — the two substrate rows with real systems
   behind them today
4. **`sovereign-mind-mcp`** — the first-party gateway, which needs no vendor
   credential and proves the pattern
5. **Vendor connectors only where leverage is proven** — the nine disabled rows
   are disabled for reasons that will still be true after the vault exists

**Anti-goal:** building vendor connectors before the vault. Nine half-built
adapters with nowhere to put a secret is nine ways to leak one.

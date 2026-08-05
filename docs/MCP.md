# MCP — Model Context Protocol

**Status:** current as of Wave 7.
**Surface:** `/integrations/mcp`
**Servers declared:** 5. **Servers connected: 0.** **MCP clients shipped: 0.**

---

## 1. The short version

This bundle ships **no MCP client**. There is no transport, no handshake, no
tool enumeration, no session, and no call path. Nothing in this repository has
ever spoken MCP to anything.

What exists is a **panel of declared intent**: five servers the operation
intends to run or has deliberately decided against, each backed by a row in the
same integration registry that `/integrations` reads, each showing the state
that registry records, and each stating why it is not connected.

That distinction is the point of the surface. An MCP panel that showed green
dots for servers nobody had contacted would be the exact failure mode the whole
architecture exists to prevent.

---

## 2. Why the panel is a lens, not a module

`/integrations/mcp` is a **sub-route of Integrations**, registered in
`subRoutes` with the id `integrations-mcp`. It is not a top-level `/mcp` module,
and the Wave 6 brief permitted either.

An MCP server *is* an integration. Giving it a module of its own would have
meant one of two things: a second table of connection state, or a module reading
another module's registry while presenting itself as the owner. The failure mode
of two state tables is specific and predictable — one of them eventually says
Connected while the other says Awaiting Credentials, and an operator has no way
to know which is lying.

So there is one registry, read two ways:

- **`/integrations`** filters all 29 connectors by state and category.
- **`/integrations/mcp`** shows the 5 rows in the `mcp` category with the
  transport, ownership, purpose, and gap each carries.

`src/integrations/mcp.test.ts` asserts the panel adds no row the registry does
not hold. It cannot invent a server.

---

## 3. The five declared servers

| Server | Ownership | Transport | State | Purpose | Gap |
|--------|-----------|-----------|-------|---------|-----|
| `hermes-memory` | First-party | HTTP | Awaiting Credentials | Long-term memory the operation owns — durable facts, preferences, constraints — shared across surfaces rather than per-browser | The server is not built. Memory lives in this browser only, on `/memory` |
| `hermesbrain` | First-party | Undecided | Awaiting Credentials | Reasoning orchestration across the memory, content, and pipeline tools | Brand surface only. No runtime exists, so nothing can call it and no tool list can be enumerated |
| `sovereign-mind-mcp` | First-party | HTTP | Awaiting Credentials | The gateway that would expose this Command Center as tools — read the brief, open a gate, record a decision — to an external agent | Not built. It also needs the Command API before any write could be authorised |
| `github-mcp` | Vendor | stdio | **Disabled** | Repository and issue reads for an agent working on this codebase | Disabled **by choice**: the read-only GitHub connector already covers the same signals, and two paths to one system is a synchronisation problem nobody asked for |
| `notion-mcp` | Vendor | HTTP | **Disabled** | Documents and databases held in Notion, exposed as tools | Disabled while Documents and Knowledge stay local-first. Nothing is lost by leaving it off, because nothing depends on it |

Two of these are `disabled` rather than `awaiting_credentials`, and the
distinction is deliberate. A vendor server the operation decided against is not
a server waiting on a key. Marking them as awaiting would have inflated the
credential gap and made the platform look more blocked than it is.

**Transport and purpose are declared intent.** They describe what a server would
carry, in the operator's words. They are never evidence that it is reachable,
which is why they live in `src/integrations/mcp.ts` next to the registry rather
than inside it: the registry holds *state*, the profile holds *description*.

---

## 4. Connected means the same thing here

The panel reads state through `effectiveIntegrationState`, exactly as
`/integrations` does. A row claiming `connected` without a `lastProbedAt`
timestamp reads as **Awaiting Credentials** on both surfaces — see
[`DATABASE.md`](./DATABASE.md) §4.

The header sentence is derived from the counts rather than written by hand, so
it cannot drift:

> No MCP server is connected. 3 awaiting credentials, 2 disabled, and this
> bundle ships no MCP client to connect with.

If a server ever *were* connected, that sentence becomes "N of 5 MCP servers
record a verified probe" — a claim about recorded probes, not about health.

---

## 5. Why no MCP client can live in this bundle

Three independent blockers, any one of which is sufficient.

### 5.1 Credentials

Every useful MCP server needs one: a GitHub token, a Notion integration secret,
an API key. A `VITE_` variable is inlined into JavaScript that anybody can read,
so a token placed in this bundle is a published token. There is nowhere in a
static deployment to put one.

### 5.2 Transport

The two standard MCP transports are both unavailable:

- **stdio** requires spawning a local process. A browser tab cannot.
- **HTTP/SSE** requires a server that permits CORS from this origin and accepts
  an unauthenticated browser client — which, for a server holding privileged
  tools, is precisely what it must not do.

### 5.3 Authority

An MCP tool call is an *action*. Even a read is an action taken on behalf of
somebody. There is no identity in this deployment — `invokedBy` is the
hard-coded string `Operator` (TD-21) — so there is nobody for a server to
authorise and no way to attribute what a call did.

---

## 6. Target topology

The architecture the audit specifies. **None of this exists.**

```
Browser (this bundle)
  │  session cookie, no secrets
  ▼
Command API                        ← holds every credential
  └─ McpGateway
       ├─ sovereign-mind-mcp   (this Command Center, as tools)
       ├─ hermes-memory        (durable memory)
       ├─ hermesbrain          (reasoning orchestration)
       └─ vendor adapters      (github, notion, … — only where leverage is proven)
```

The gateway is the load-bearing piece. It is where credentials live, where
transports are opened, where a call is attributed to an operator, and where a
tool result is audited. Once it exists:

- A real probe replaces the declared state, and `Connected` becomes a
  measurement — recorded through the same `recordIntegrationProbe` contract the
  `/sync` probe already uses.
- The automation `handoff` action, which currently **always refuses**, gains
  something it could hand off to.
- `sovereign-mind-mcp` can expose this surface's own operations as tools, at
  which point an external agent could read the brief or open a gate — through
  the approval queue, not around it.

---

## 7. Order of construction

MCP is deliberately late in the sequence, and the order is a dependency chain
rather than a preference:

1. **Command API with sessions** — nothing below is safe without it.
2. **Credential vault** — `POST /integrations/{id}/probe` returning state and
   timestamp only, never the secret.
3. **`sovereign-mind-mcp` first** — the first-party server over the domain
   already modelled here. It needs no vendor credential and it is the one that
   proves the gateway works.
4. **`hermes-memory` second** — memory is the capability with the clearest
   leverage once it outgrows one browser.
5. **Vendor servers only where leverage is proven.** `github-mcp` and
   `notion-mcp` are disabled today for reasons that will still be true after the
   gateway exists.

**Anti-goal:** building vendor MCP servers before the gateway. Five half-built
adapters with no credential store is five ways to leak a token and no working
tool call.

---

## 8. What would change on this surface

When a gateway exists, the panel gains exactly three things and no more:

| Addition | Constraint |
|----------|------------|
| A real probe per server | Written through `recordIntegrationProbe`. `Connected` still requires the timestamp |
| A tool list per connected server | Enumerated from the server, never from a local declaration. A server that will not enumerate shows no tools |
| A call log | Every invocation, its arguments' shape, its outcome, and who invoked it — in the same activity log every other write uses |

What it does **not** gain: a latency number, a "healthy" badge, a tool count for
a server that was never reached, or any state not backed by a recorded probe.

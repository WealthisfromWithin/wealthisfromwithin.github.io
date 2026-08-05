# API

**Status:** current as of Wave 7.

This repository **serves no API**. It is a static bundle. This document
describes the two HTTP boundaries it can *call*, exactly what it sends over
each, and the contract a Command API would have to satisfy to be worth
connecting to.

Everything in §2 is implemented and tested. Everything in §4 is a contract for
software that does not exist yet, and is marked as such throughout. Nothing in
this repository behaves as if §4 were built.

---

## 1. The two outbound calls, in full

There are exactly two places in the entire codebase that call `fetch`, and both
are off by default:

| Caller | Method and path | Configured by | Default |
|--------|-----------------|---------------|---------|
| `src/modules/sync/sync.ts` | `GET {base}/health` | `VITE_API_BASE_URL` | Unset — no request is made |
| `src/agents/providers/local.ts` | `GET {base}/api/tags`, `POST {base}/api/chat` | `VITE_LOCAL_AI_URL` | Unset — no request is made |

No third path exists. There is no analytics beacon, no error reporter, no font
CDN, no telemetry, and no provider SDK. The Content Security Policy on the built
`index.html` ships `connect-src 'self'`, so in the public deployment the browser
would refuse a cross-origin request even if one were somehow attempted.

---

## 2. Command API health probe — implemented

The `/sync` surface. One capability, and it is the smallest honest one
available: ask a configured origin whether it answers.

### Request

```http
GET {VITE_API_BASE_URL}/health
```

Sent with:

| Option | Value | Why |
|--------|-------|-----|
| `credentials` | `'omit'` | There is no cookie, token, or key in this bundle to send. Omitting makes that structural rather than incidental |
| headers | *none* | A custom header would add a CORS preflight to a request whose only job is to prove reachability |
| `mode` | `'cors'` | Cross-origin by definition |
| `cache` | `'no-store'` | A cached 200 would be a stale claim about the present |
| `signal` | `AbortSignal.timeout(8000)` | A hung origin must not hang the surface |

### Base URL validation

`resolveApiBaseUrl` parses `VITE_API_BASE_URL` before anything is sent, and
**refuses** four cases. Each is a way a base URL can carry a secret or downgrade
the connection, and a refusal is reported to the operator as loudly as a failed
probe:

| Refusal | Reason |
|---------|--------|
| Unparsable as a URL | There is nothing to call |
| Not `https:` on a public host | A plaintext API leaks whatever it answers. `http:` is allowed **only** on `localhost`, `127.0.0.1`, `[::1]` — the operator's own machine, the same exception the local model adapter makes |
| Contains userinfo (`https://user:token@host`) | That is a credential, and a `VITE_` variable is published |
| Contains a query string or fragment | `?api_key=…` is the other way a credential arrives, and a base URL needs neither |

An accepted base is rebuilt from the parsed URL as `origin + pathname` with
trailing slashes stripped, so the `/health` path is appended to something the
adapter has already understood. **Only the host is ever printed in the UI** —
never the full URL.

### Response handling

| Outcome | Recorded state | What it means |
|---------|----------------|---------------|
| `2xx` | `connected` | An origin answered. **Not** authorisation, **not** a sync |
| Non-2xx | `awaiting_credentials` | The origin is reachable and did not report itself healthy. Status code recorded |
| Network error / timeout | `awaiting_credentials` | Recorded with the error message |
| No base URL configured | `disabled` | No request was made |

Every outcome — including failures — carries the timestamp of when the probe
ran, and that result is written to the `contentdone` registry row through
`recordIntegrationProbe`. That writer refuses a result with no parseable
timestamp, which is how the connected-probe invariant holds at the boundary.

### What a 2xx does not mean

The `/sync` page lists five capabilities as **Not implemented**, each with the
reason:

| Capability | Why it is absent |
|------------|------------------|
| Remote read-model | Needs an API that serves records and a session that authorises the read. No remote record has ever entered this store |
| Write-through | Every mutation writes to IndexedDB and stops. Nothing queues, retries, or waits to be flushed, so there is no pending-sync state to misread |
| Conflict resolution | One writer, one store, no conflicts. A second writer would need record versions and a merge policy first |
| Operator session | No sign-in, no account, no token store. A static bundle cannot keep a secret |
| Credential vault | Connector credentials belong on the Command API. This bundle holds none and offers no field to type one into |

There is no code path in the module that can report a record having moved.

---

## 3. Local model endpoint — implemented

The only AI provider that can run from this bundle, because it is the only one
that needs no secret.

```http
GET  {VITE_LOCAL_AI_URL}/api/tags     # reachability
POST {VITE_LOCAL_AI_URL}/api/chat     # { model, stream: false, messages }
```

Ollama-shaped. The response is parsed with zod and only `message.content` is
read; a response in any other shape is a `provider_error` refusal rather than a
guess.

**The host must be loopback** — `localhost`, `127.0.0.1`, or `[::1]`. LAN and
private addresses are deliberately excluded: they are other machines, and the
adapter reports `external: false` to the kernel, which is what allows a turn to
run under `allowExternalCalls: false`. A non-loopback URL is refused **before**
any request is built, so nothing is sent to it — not even a probe.

The four hosted adapters (OpenAI, Anthropic, Gemini, OpenRouter) live behind the
same interface, report `awaiting_credentials`, name the registry row that would
fix them, and **contain no code path that produces text**. They exist so the
boundary is visible, not so a key can be dropped in.

---

## 4. Command API contract — not built

What follows is a specification for a service that does not exist. No client
code in this repository implements any of it beyond `/health`, and nothing
behaves as though it does.

### Why it has to exist at all

Three capabilities are impossible in a static bundle and only become possible
behind a server:

1. **Holding a secret.** Every connector credential, every hosted-model API key,
   and every MCP token. A `VITE_` variable is published; a server-side secret is
   not.
2. **Verifying an identity.** Auth requires something that can check a
   credential and issue a session. Pages cannot.
3. **Being a second writer.** Multi-device use means a shared record of truth,
   which means versions and conflict policy.

Everything the platform currently declares as absent traces back to one of those
three.

### v1 surface

The smallest API that would unblock the current deferrals, in dependency order.

#### `GET /health` — the only one implemented client-side

```http
200 OK
{ "status": "ok", "version": "…", "time": "2026-08-05T20:00:00.000Z" }
```

Any 2xx is treated as reachable. The body is not parsed today, deliberately: an
adapter that required a body shape would fail against a plain health endpoint
and report unreachable, which would be a worse lie than a bare 200.

Must permit CORS from the Pages origin, and must **not** require credentials.

#### `POST /auth/session`

Issues an operator session. `HttpOnly`, `Secure`, `SameSite=Strict` cookie —
**not** a token handed to JavaScript, because a token in a public bundle's
JavaScript is a token in the page.

Rate-limited. This is the first endpoint that makes any of the rest safe.

#### `GET /records/{collection}?since={iso}` — the read-model

Delta reads keyed on `updatedAt`. Collections map to the 30 stores in
[`DATABASE.md`](./DATABASE.md). Server rows arrive with `source: 'remote'` —
the value the domain already declares and nothing currently writes.

#### `POST /records/{collection}` — write-through

Requires a version or ETag per record so a conflict is detectable rather than a
silent last-write-wins. Returns the reconciled row.

Until conflict policy is decided, the honest v1 is read-only.

#### `GET /integrations` and `POST /integrations/{id}/probe`

The credential vault. The API holds connector secrets, performs the real probe
server-side, and returns **state and timestamp only** — never the credential.
This is what turns the registry from a declaration into a measurement, and it is
the endpoint that would finally let a connector other than the Command API row
itself read `Connected`.

#### `POST /ai/complete`

A server-side proxy for the hosted providers. The key stays on the server; the
bundle sends messages and receives text. The kernel interface already
accommodates this — it would be a fifth adapter, reporting `external: true`.

#### `POST /mcp/{server}/call`

Tool invocation through a gateway. See [`MCP.md`](./MCP.md) for why no MCP
client can live in this bundle.

### Requirements on any implementation

| Requirement | Reason |
|-------------|--------|
| CORS restricted to the Pages origin | The bundle is public; the API should not be |
| Session cookies, never bearer tokens in JS | A token this bundle can read is a token an attacker can read |
| Rate limits on auth, AI, and webhooks | The client is public and its source is on GitHub |
| Connector secrets encrypted at rest | The vault is the whole point of the service |
| Audit log for approvals, credential changes, and agent runs | The local activity log covers this browser only |
| Response headers for CSP, HSTS, and `frame-ancestors` | Pages cannot set headers. See [`OPERATIONS.md`](./OPERATIONS.md) |

### ContentDone as the v1 adapter

The audit's plan (§7 Wave 7) is to adapt ContentDone's existing `/api` rather
than write a new service. That repository already has the honesty pattern worth
keeping: `getPublicConfig()` returns booleans for configured connectors and
skips work when URLs are missing, rather than failing at call time.

The registry row `contentdone` is the row the `/sync` probe writes to, and the
`/health` path this adapter knows is the one ContentDone already serves. Nothing
else about ContentDone is assumed, and this repository contains no ContentDone
code, schema, or credential.

---

## 5. What will not be built here

| Not building | Why |
|--------------|-----|
| An API server in this repository | This is the Pages surface. Two deployables in one repo is how the org path drift in TD-13 happened |
| A client-side credential field | There is nowhere safe to put what it collects |
| An offline write queue | A queue that never flushes is a pending-sync state that lies. It arrives with the endpoint that drains it |
| Optimistic remote state | Nothing may render as synced before a server confirms it |

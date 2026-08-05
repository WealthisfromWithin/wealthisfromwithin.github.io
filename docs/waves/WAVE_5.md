# Wave 5 — Cognition

**Implementer:** Claude (Implementation Engineer)
**Plan:** `docs/IMPLEMENTATION_PLAN_WAVE_5.md`
**Architecture:** `ARCHITECTURE_AUDIT.md` §5.6 (Agent Kernel), §7 Wave 5
**Predecessor:** `docs/waves/WAVE_4.md` (G3 PASS after the M1 fix pack)
**Status:** complete — G3 H1 fix pack applied, awaiting re-review

---

## What changed

Wave 4 made the thing that produces the money motion operable. Wave 5 makes
**what the operation knows** operable: seven modules are now routed — four
promoted from `planned` (knowledge, research, ai, decisions) and three new to
the registry (memory, documents, prompts) — eight Dexie stores appeared, and the
Agent Kernel stopped being an interface with nothing behind it and became a
kernel with five adapters, four of which refuse.

The through-line is again what the store can honestly claim, but the pressure is
different. Wave 4 had to avoid faking a publish. Wave 5 has to avoid faking a
**thought** — a summary nobody wrote, an answer nobody found, a completion no
provider generated. So the rule is enforced at the type level rather than by
convention: `AgentMessage.generated` is true only when a provider returned the
text, `AgentResult` makes `generated: false` the only shape a refusal can have,
and there is no code path in `runAgentTurn` that writes assistant text the
kernel did not return. Research findings are typed by hand and their `source` is
rendered as text rather than as a link, because this surface has no crawler and
must not look as though it followed one. Documents render through a block
splitter that emits text nodes only, so a body containing `<script>` shows those
characters.

## Enabled vs hidden

| Module | Route | Group | Wave | State |
|--------|-------|-------|------|-------|
| Morning Brief | `/` | Commander | 1 | enabled |
| Approval Queue | `/approvals` | Commander | 2 | enabled |
| Health Monitor | `/health` | Commander | 2 | enabled |
| **Decision Log** | **`/decisions`** | **Commander** | **5** | **enabled (new)** |
| Inbox | `/inbox` | Operator | 2 | enabled |
| CRM | `/crm` | Operator | 3 | enabled |
| Pipeline | `/pipeline` | Operator | 3 | enabled |
| Tasks | `/tasks` | Operator | 3 | enabled |
| Projects | `/projects` | Operator | 3 | enabled |
| Calendar | `/calendar` | Operator | 3 | enabled |
| Meetings | `/meetings` | Operator | 3 | enabled |
| Content OS | `/content` | Operator | 4 | enabled |
| **Knowledge** | **`/knowledge`** | **Operator** | **5** | **enabled (new)** |
| **Memory** | **`/memory`** | **Operator** | **5** | **enabled (new)** |
| **Documents** | **`/documents`** | **Operator** | **5** | **enabled (new)** |
| **Research** | **`/research`** | **Operator** | **5** | **enabled (new)** |
| **AI Workspace** | **`/ai`** | **Operator** | **5** | **enabled (new)** |
| **Prompt Library** | **`/prompts`** | **Operator** | **5** | **enabled (new)** |
| Integrations | `/integrations` | Operator | 1 | enabled |
| Settings | `/settings` | Operator | 1 | enabled |

Twenty modules are enabled. Five remain `planned` — Mission Control,
Automations, Business Metrics, Analytics (Wave 6) and Command API Sync (Wave 7)
— with no route, no nav entry, and a roadmap listing in Settings only.
`src/app/modules.test.ts` asserts both halves: every Wave 5 module is enabled by
id, and every module with `wave > 5` is still `planned`.

Decisions sits under Commander because a call nobody has made is an attention
item, not a filing cabinet — the same reason the Approval Queue is there. The
other six are Operator surfaces.

### Record routes (three new)

| Route | Record |
|-------|--------|
| `/knowledge/node/:id` | Knowledge node with its body, links, and backlinks |
| `/documents/doc/:id` | Document, rendered as blocks |
| `/decisions/entry/:id` | One decision, its alternatives, and the call |

Each follows the Wave 4 rule: a segment names the record type, so a node id can
never collide with — or be mistaken for — a surface of its own module. No Wave 5
module needed sub-routes; each is one list, and the three that have detail worth
a page got a record route instead of a tab strip.

## Agent Kernel

`src/agents/kernel.ts` keeps its Wave 1 shape and gains the parts a real
registry needs. The kernel's own contribution is **refusal**: it never produces
text, so there is no path by which a surface can show a completion no provider
generated.

- `AgentResult` is a discriminated union. The success branch is
  `generated: true` with a provider id; the refusal branch is `generated: false`
  with a reason from `no_provider | awaiting_credentials | policy_blocked |
  provider_error` and a message. A refusal cannot carry text.
- `AgentPolicy` defaults to `requiresApproval: true` (the WITHIN human gate) and
  `allowExternalCalls: false` — a static bundle holds no credentials, and a call
  it cannot authenticate is a call it should not attempt.
- **The kernel owns the approval flag.** A provider's `requiresApproval` is
  overwritten by the policy on the way out, so an adapter cannot decide that its
  output skips the gate.
- `run` walks the adapters in preference order, then registration order,
  collecting refusals. It returns the *most explanatory* one — ranked
  `no_provider > policy_blocked > awaiting_credentials > provider_error` —
  because "awaiting credentials" tells the operator more than the error of a
  provider they never configured. A thrown adapter becomes `provider_error`
  rather than an unhandled rejection.
- `roster()` lists registered adapters without probing; `health()` probes them
  all. The AI Workspace reads both, which is why its table cannot drift from
  what the kernel would actually act on.

### Provider adapters (`src/agents/providers/**`)

The eslint boundary that has existed since Wave 1 finally has something to
guard: provider SDK imports are forbidden everywhere except
`src/agents/providers/**`, and `src/app`, `src/modules`, and `src/ui` may not
even import an adapter path — only `@/agents`.

| Adapter | External | Default state | Can it ever run here? |
|---------|---------:|---------------|-----------------------|
| `local` | no | `unconfigured` | **Yes** — set `VITE_LOCAL_AI_URL` to an Ollama-shaped runtime |
| `claude` | yes | `awaiting_credentials` | No |
| `openai` | yes | `awaiting_credentials` | No |
| `gemini` | yes | `awaiting_credentials` | No |
| `openrouter` | yes | `awaiting_credentials` | No |

`createLocalProvider` is the only adapter that can succeed, because it is the
only one that needs no secret: the endpoint is a loopback URL, not a credential.
With no endpoint it reports `unconfigured` and **names the variable that would
configure it**, and `complete` refuses with `no_provider`. With a **loopback**
endpoint it probes `/api/tags` for health and posts to `/api/chat` for a turn,
parsing the response with zod and refusing `provider_error` on a shape it does
not recognise. It returns only text the endpoint actually sent. A non-loopback
endpoint is refused before a request is built — see the fix pack below, which is
where that check came from.

The four hosted adapters exist so the roster the AI Workspace prints comes from
the kernel rather than from a hard-coded list in a component. Each carries the
integration registry row an operator would configure (`anthropic`, `openai`,
`gemini`, `openrouter`), and **there is deliberately no code path in that file
that produces text**. Until the Command API can hold a key and sign a request,
`awaiting_credentials` is the only honest answer (§5.9).

`readAgentEnv` reads `VITE_LOCAL_AI_URL` and `VITE_LOCAL_AI_MODEL` through a
typed `ImportMetaEnv` augmentation in `src/vite-env.d.ts`, so no cast is needed
and no other variable is read. No hosted adapter reads the environment at all —
a key in `import.meta.env` is a key in the published bundle.

## Domain and data

| Entity | Shape and the honesty constraint on it |
|--------|----------------------------------------|
| `KnowledgeNode` | `kind` (note, insight, reference, playbook, question), summary, body, tags, `origin` in the operator's words, links to people/company/opportunity/content/meeting/documents, `relatedNodeIds`, `pinned`, `reviewedAt`, `archivedAt`. Archived, never deleted. |
| `MemoryEntry` | `statement` plus `kind` (fact, preference, constraint, context, lesson) and `scope` (operator, business, relationship, system). `confidence` is a **provenance word** — stated, observed, inferred — not a percentage, because a percentage would be a score nobody measured. `reviewAt` decays the memory; `retiredAt` retires rather than deletes. |
| `SovereignDocument` | Named to avoid colliding with the DOM `Document`. Kind, status (draft/final/archived), body, `format`, author, links. Metadata plus text: nothing is uploaded or hosted. |
| `Decision` | Context (the question), choice (the answer, empty until made), rationale, alternatives, consequences, `impact`, `reversible`, `dueAt`, `reviewAt`, `supersededById`. `DECISION_TRANSITIONS` is one table: `proposed → decided \| withdrawn`, `decided → superseded \| proposed`, and nothing out of `superseded` or `withdrawn`. |
| `Prompt` | Intent, body with `{{placeholders}}`, declared `variables`, `providerPreference`, `requiresApproval` (WITHIN default true), `useCount`, `lastUsedAt`. Browsable and editable with no provider configured. |
| `ResearchItem` | Question, topic, status (queued, active, answered, parked), priority, `dueAt`, `findings[]`, `answer`. Every finding is `{ at, note, source }` typed by hand; `source` is free text rendered as text. |
| `AgentSession` / `AgentMessage` | A session carries intent, provider preference, `requiresApproval`, and `unansweredCount` — turns the kernel could not run, which the Brief counts and never hides. A message carries `generated`, `provider`, `outcome` (sent, generated, refused) and the refusal `reason`. `generated` is true **only** when a provider produced the text: a refusal, an operator note, and a seeded example are all false. |

**Dexie version 5** adds eight stores — `knowledgeNodes`, `memoryEntries`,
`documents`, `decisions`, `prompts`, `researchItems`, `agentSessions`,
`agentMessages` — indexed on the fields the selectors query. Every table is new,
so there is nothing to migrate: a version-4 store gains eight empty stores and
keeps every row it had.

`ActivityEvent.channel` gained `cognition`. Cognition writes are not system
events and not execution events, and folding them into either would have made
the Health log's channel filter lie about what it was showing.

### Seed (`SEED_VERSION = 'wave5.0'`)

6 knowledge nodes, 7 memories, 5 documents, 6 decisions, 6 prompts, 6 research
items, 2 agent sessions with 4 messages, plus cognition notifications and
events. Every row is `source: 'demo'` and badged, and `clearDemoData` removes
all eight stores whether or not a row was touched.

The demo is chosen to make the loop legible rather than to look full: a decision
overdue and a decision due for review, a memory past its review date, two
overdue questions and one already answered in the operator's own words, a
question whose two findings were typed by hand, and — the important one — **two
agent sessions whose last turn was refused**, seeded with
`generated: false, outcome: 'refused'`. The demo therefore shows the surface's
real behaviour with no provider rather than a transcript that implies one.

## Mutations

`src/data/mutations.ts` is still the only write path; Wave 5 adds 23 writers.
Each stamps `touchedAt` so the 12-hour reseed (TD-17) cannot undo operator work,
each writes a `cognition`-channel event, and each returns `{ ok, reason }` or
the created record rather than a bare boolean.

- **Knowledge** — `captureKnowledgeNode`, `setKnowledgePinned`,
  `reviewKnowledgeNode`, `archiveKnowledgeNode` (and un-archive).
- **Memory** — `saveMemoryEntry`, `setMemoryPinned`, `recallMemoryEntry`
  (counts a recall), `confirmMemoryEntry` (pushes the review date out),
  `retireMemoryEntry` (and restore).
- **Documents** — `createDocument`, `setDocumentStatus`, refusing a move to the
  status a document already holds.
- **Decisions** — `recordDecision` (a call with a choice and a rationale lands
  `decided`; one without lands `proposed`), `decideDecision`, `setDecisionStatus`
  (through `canTransitionDecision` only), `supersedeDecision`, which links both
  directions in one transaction.
- **Prompts** — `savePrompt`, `recordPromptUse`, and `promptVariables`, which
  reads `{{placeholders}}` off the body so the declared variables cannot drift
  from the text.
- **Research** — `captureResearchItem`, `setResearchStatus`,
  `recordResearchFinding` (which moves a queued question to `active`, because a
  question someone is finding things about is in progress),
  `answerResearchItem`.
- **Agents** — `startAgentSession` and `runAgentTurn`.

`runAgentTurn` is the only path by which agent output can reach the store. It
writes the operator's message, asks the kernel, and writes back **whatever the
kernel returned** — a completion with its provider, or the refusal with its
reason code — then increments `unansweredCount` when the turn was refused. Prior
refusals are excluded from the history sent to the next turn, so a refusal
message never becomes context that a provider would treat as conversation.

## AI Workspace honesty

The brief's hard line — never fake live provider success — is enforced in four
places:

1. **The page imports `agentKernel`, never an adapter.** eslint fails the build
   otherwise. Provider status comes from `kernel.health()`, so the table cannot
   claim a state the kernel would not act on.
2. **The composer states which of the two things sending will do.** With no
   adapter ready the button reads *Send and record the refusal* rather than
   *Send*, and the helper line says the message and the kernel's refusal will
   both be recorded.
3. **Refused turns render as refusals** — badged, with the kernel's reason code,
   in the same thread as any completion. `providerSummary` never says "ready"
   unless an adapter is, and with none it prints the count awaiting credentials
   against the count unconfigured or unreachable.
4. **The human gate is stated on every session.** Anything a session produces
   requires approval before it is used; that is the policy default, and the
   kernel — not the adapter — applies it.

Each provider row links to the integration registry entry an operator would
configure, so `/ai` and `/integrations` tell one story about the same credential
gap.

## The other surfaces, and what each refuses to imply

- **Knowledge** — pinned first, then active, archived behind a filter. Links are
  local joins rendered from both ends: a node points at the records it is about,
  and the detail page computes the backlinks. No embeddings, no similarity, no
  "related" that was not typed.
- **Memory** — working set excludes retired entries; anything past `reviewAt` is
  flagged for confirmation rather than quietly trusted. Provenance
  (stated/observed/inferred) prints next to every statement.
- **Documents** — `documentBlocks` reads exactly two markdown affordances,
  `#`/`##` headings and `-`/`1.` list items, and emits plain text blocks.
  This is deliberately **not** a markdown parser: a parser producing HTML would
  need sanitising, and sanitising is the class of bug this avoids entirely.
- **Decisions** — proposed calls lead, overdue ones are flagged critical, and a
  one-way door is labelled as one. Recording a call requires both a choice and a
  reasoning; the page refuses with a message rather than writing half a decision.
- **Prompts** — fully usable with no provider: browse, filter by intent, edit,
  and read the placeholders the body declares. Prompts whose `requiresApproval`
  is set are marked gated. Ranking is by use count, which is a count.
- **Research** — the page states in plain words that there is no crawler and no
  search connector, and that every finding below was typed by someone. Sources
  render as text, never as anchors.

## Brief, search, and palette

- **Attention** gained decisions awaiting a call (overdue and one-way doors
  ranked critical), decisions past their review date, overdue questions, and a
  single aggregate line for memory needing review. `ATTENTION_LIMIT` rose from 9
  to 12, and the two aggregate lines — the integration credential gap and the
  memory review count — are pushed to the front so class-level alerts survive
  truncation. A record-level row being cut is a smaller loss than the one line
  that explains why nothing external can act.
- **Blocked** gained agent sessions the kernel could not run, counted by
  `unansweredCount` and described as blocked on a credential rather than on
  work.
- **Search** gained six kinds — `knowledge`, `memory`, `document`, `decision`,
  `prompt`, `research` — each routing to the surface or record page that can act
  on it. Matching is the existing fuzzy matcher over titles, subtitles, and
  keywords. Nothing here is semantic, and nothing claims to be.
- **Palette** gained six entries: *Decisions awaiting a call*, *Memories past
  their review date*, *Open research questions*, *Pinned knowledge*, *Open the
  document store*, and *Open the AI Workspace*. The parity tests still hold:
  every palette target
  must resolve to a route the router serves and pass `isSafeInternalHref`.

## Href safety and lazy routes

`ALLOWED_QUERY_PARAMS` declares the filter values each new surface accepts —
`view`/`kind` on knowledge, `kind`/`state` on memory, `status`/`kind` on
documents, `status` on decisions, `intent` on prompts, `status` on research —
and `knowledgeHref`, `documentHref`, and `decisionHref` validate their own
output and degrade to the list route. `/ai` takes no query parameter: session
selection is component state, because a session id in the URL would be a record
route without a record page behind it.

All ten new pages are `React.lazy`, registered in `src/app/lazyModules.ts` and
mapped in the router from the registry. `src/app/router.test.tsx` mounts every
enabled module, sub-route, and record route, so a broken lazy import fails the
suite rather than the browser.

## Code splitting

| | Wave 4 | Wave 5 |
|---|---:|---:|
| First-load chunks | 582.31 kB / 181.65 kB gzip | 645.71 kB / 199.57 kB gzip |
| Deferred route chunks | 21 chunks, 120.49 kB / 38.34 kB gzip | 32 chunks, 205.01 kB / 65.40 kB gzip |

Ten new page chunks hold 78.9 kB (the decision detail page being the largest at
10.7 kB) and the kernel plus its adapters ship as a shared 4.7 kB lazy chunk
reached only from `/ai` and Settings. The first load grew by 63.4 kB, almost all
of it the seed and the eight new zod schemas, both of which are eager because
the store opens at boot. The 500 kB advisory stands; the shared chunk is still
React, React Router, Dexie, and Zod, and only the Wave 7 vendor-chunking pass
moves it.

## Verification

| Command | Result |
|---------|--------|
| `pnpm lint` | 0 errors, 0 warnings |
| `pnpm typecheck` | clean |
| `pnpm test` | **644 tests, 49 files, passing** (Wave 4: 409 / 31) — 612 / 48 before the fix pack |
| `pnpm build` | success — 645.71 kB first load + 32 lazy chunks, one chunk-size advisory (TD-16) |

203 tests were added, 191 of them in 17 new files:

- `src/agents/kernel.test.ts` (12) — refusal with an empty registry, the
  external-call policy block, the kernel overwriting a provider's approval flag,
  fallback to the next adapter, preference ordering, and the most-explanatory
  refusal winning.
- `src/agents/providers/providers.test.ts` (14, then 44 after the fix pack) — the
  local adapter unconfigured, probing, unreachable, returning only text the
  endpoint sent, and refusing an unrecognised shape; the four hosted adapters
  reporting `awaiting_credentials` and refusing every completion; default
  provider order and env parsing; and the endpoint policy described in the fix
  pack.
- `src/data/cognition.mutations.test.ts` (34) — all 23 writers: provenance
  (`source: 'local'`), the event on each channel, decision transitions honoured
  and refused, supersession linking both ways, a finding activating a queued
  question, review dates pushed out, and `runAgentTurn` writing a refusal
  verbatim.
- Selector suites (13 + 13 + 12 + 11 + 11 + 10 + 10) for decisions, documents,
  the AI workspace, knowledge, research, memory, and prompts — filters,
  ordering, counts, joins, the date logic behind overdue and due-for-review, and
  `documentBlocks` rendering markup as characters.
- Page suites (10 + 7 + 7 + 7 + 7 + 6) clicking through against a real
  IndexedDB, including the AI Workspace reporting provider status honestly and
  writing a kernel refusal into the thread rather than a completion.

The remaining 12 landed in the registry, href, router, brief, and palette
suites, which grew to cover the new modules. **Wave 4's content approval sync
(M1) is untouched and still green:** `src/data/mutations.test.ts` (68) and
`src/modules/approvals/ApprovalsPage.test.tsx` (7) pass unchanged.

## Deferrals (intentional)

1. **No embeddings and no semantic search.** Search over the new entities is the
   existing fuzzy matcher. Semantic retrieval needs an embeddings provider, and
   the only one available is `awaiting_credentials`; a similarity score computed
   some other way would be the fake the audit exists to prevent.
2. **No document upload or file storage.** `/documents` holds metadata and text
   that lives in IndexedDB. A file picker would imply hosting that does not
   exist.
3. **No prompt execution from `/prompts`.** A prompt opens a session in `/ai`,
   which is where the kernel and its policy live. Running one from the library
   would be a second path to the same gate.
4. **No memory extraction from conversations.** Memories are written by the
   operator. Deriving them from transcripts is a model task, and no model runs
   here.
5. **No decision reminders or scheduling.** `reviewAt` and `dueAt` are read by
   the Brief; nothing notifies out of band, because nothing here can send.
6. **No cross-entity link editor.** Seeded links are rich; the capture forms
   collect the record's own fields. Attaching a node to an opportunity from the
   UI needs the same form layer TD-25 is waiting on.
7. **Wave 6+ modules** — Mission Control, Automations, Business Metrics,
   Analytics, Command API Sync — remain registered and hidden.

## Debt movement

| ID | Movement |
|----|----------|
| TD-06 | **Partly paid.** Hosted providers are no longer "stubbed" in the vague sense: four adapters exist behind one interface, report `awaiting_credentials` with the registry row that would fix it, and refuse every call. They close fully when the Command API can hold a key (Wave 7). |
| TD-15 | **Partly paid.** There is a runtime now: a kernel that selects, applies policy, and refuses, plus a local adapter that genuinely runs against an operator's own endpoint. Named agents with roles remain Wave 6. |
| TD-16 | **Held, larger.** Ten more lazy chunks kept 78.9 kB out of the first load, but the seed and eight new schemas pushed it to 645.71 kB. Vendor chunking (Wave 7) is still the only thing that moves the advisory. |
| TD-17 | **Held.** All 23 cognition writers stamp `touchedAt`; a recorded decision or a saved memory survives the reseed. |
| TD-19 | **Held.** 23 new writers, same module, and they adopt the `{ ok, reason }` shape Wave 4 introduced. |
| TD-20 | **Larger.** An eighth channel (`cognition`) appends to the same unbounded activity log. Retention remains Wave 7. |
| TD-03 | **Held.** Counts are counts: recall counts, use counts, finding counts, unanswered turns. Memory confidence is a provenance word rather than a score, precisely so nothing here looks modelled. |
| TD-21 | **Held, and more visible.** `decidedBy` defaults to the same hard-coded `Operator` as every other actor field. A decision log is the first surface where the actor genuinely matters. |
| TD-23 | **Held.** The three new record href builders validate id shape, not existence; a link to a cleared node lands on "Not in the local store". |
| TD-24 | **Larger.** `href.ts` now reads filter constants from six more selector modules, pulling more selector code into the shared chunk. Same Wave 7 fix. |
| TD-27 | **Unpaid, deferred to Wave 6.** Nothing in Wave 5 touched content readings. |

## New debt

| ID | Debt | Severity | Note |
|----|------|----------|------|
| TD-29 | Memory review dates decay on a fixed interval nobody chose | Low | `confirmMemoryEntry` pushes `reviewAt` out by a default 90 days. Different kinds of memory decay at different rates — a constraint outlives a context — and the interval should be per-kind or operator-set. |
| TD-30 | Agent session history has no token or length bound | Low | `runAgentTurn` sends the whole non-refused history to the kernel. With no provider it costs nothing; the moment a local runtime is configured, a long session sends a large prompt with nothing to trim it. |
| TD-31 | Knowledge links are one-directional in storage | Low | `relatedNodeIds` is stored on one side and the backlink is computed by scanning. Correct and cheap at demo scale, an O(n) scan per detail page at any other. |

## Deviations from the brief

1. **The entity is `SovereignDocument`, not `Document`.** `Document` is a DOM
   global; a domain type shadowing it would make every `lib.dom` reference in a
   file that imports the domain ambiguous. The store, the routes, and the UI all
   say "document"; only the TypeScript symbol is qualified.
2. **`ProviderHealthState` gained `unconfigured`.** The brief's states are ready,
   awaiting credentials, and disabled. The local adapter needs no credential — it
   needs an endpoint — so reporting it as `awaiting_credentials` would have
   pointed the operator at a credential vault that is not the fix. Five states,
   with `unconfigured` naming the variable that resolves it.
3. **Four hosted adapters ship even though none can run.** The brief made them
   optional. They were included because the boundary is only real if the roster
   comes from the kernel, and because "OpenAI is awaiting credentials" is a
   fact worth rendering from a registered adapter rather than a hard-coded list.
4. **Decisions is a Commander module.** The brief marked it optional. An unmade
   decision is an attention item, and Commander is where attention items live.
5. **`ActivityEvent.channel` gained `cognition`.** Reusing `system` would have
   made the Health log's channel filter misleading. It is an enum widening with
   no migration, since Dexie only indexes the value.
6. **`ATTENTION_LIMIT` rose from 9 to 12, and two aggregate lines are pinned to
   the front of the section.** Four new attention sources would otherwise have
   crowded out the credential-gap line, which is the only row that explains why
   nothing external can act at all.
7. **No `?session=` parameter on `/ai`.** Session selection is component state.
   A session id in the URL would need a record route and a page that serves it,
   and a thread is not a record worth a permalink while nothing can generate.
8. **Prior refusals are stripped from the history sent to the kernel.** Not
   specified. A refusal is the surface talking to the operator, not the operator
   talking to a model, and feeding it back would make the next prompt include
   text about credentials.

## Fix pack — the local endpoint is loopback or it is nothing (G3 H1)

`docs/reviews/WAVE_5_GPT_REVIEW.md` H1 and the G3 gate
(`docs/reviews/WAVE_5_G3_ALIGNMENT.md`) held the wave on one thing, and it was
the one place where a claim in this wave was not earned. `createLocalProvider`
reported `external: false`, and the kernel takes that flag as the whole truth
about an adapter: it is what allows a turn to run while
`allowExternalCalls: false`. But the adapter accepted whatever URL
`VITE_LOCAL_AI_URL` held. A build configured with
`VITE_LOCAL_AI_URL=https://models.example.com` therefore probed that host, and
posted the whole session history to it, while the UI printed "Local model" and
the policy that exists to stop exactly that never saw the call. The policy was
being decided by an environment file.

The fix is to make the flag true rather than to weaken it. `resolveLocalEndpoint`
parses the configured value with `URL` and accepts it only when the scheme is
`http`/`https` and the host is `localhost`, `127.0.0.1`, or `[::1]`. Everything
else — a remote host, a lookalike such as `localhost.example.com`, a userinfo
trick such as `http://localhost@example.com`, a LAN address, `0.0.0.0`, a
`file:`/`ws:`/`javascript:` URL, or a string that is not a URL at all — is
refused, and refused *before* a request exists: `health` reports `unconfigured`
and `complete` refuses `no_provider`, with **no `fetch` on either path, not even
a probe**. Parsing also normalises: the base the adapter appends `/api/tags` and
`/api/chat` to is rebuilt from the parsed origin and path, so a query string or
fragment cannot ride along into a request.

LAN and private addresses were considered and left out. They are other machines,
and reaching one while reporting `external: false` would be the same untrue
claim in a smaller radius. If a private host is ever needed it has to arrive as
`external: true` and go through the policy like every other remote provider.

The refusal is phrased for the operator who caused it: it names the host that
was rejected, says the adapter only calls loopback, and says nothing was sent
there. It reports `url.host` rather than the configured string, because a
misconfigured value can carry credentials in its userinfo and that sentence is
rendered in the UI. The health state stays `unconfigured` — the pill reads *Not
configured*, the roster summary still reads *No adapter can run a turn*, and the
composer still offers to record a refusal — so a misconfigured build cannot look
like a working one.

Thirty-two regressions cover it. `src/agents/providers/providers.test.ts` takes
the accepted forms (including `http://[0:0:0:0:0:0:0:1]` and an upper-case
scheme, both of which `URL` normalises) and fifteen refused ones through
`resolveLocalEndpoint`, asserts that health and completion against a remote
endpoint leave the injected `fetch` uncalled, and runs the whole default roster
through the kernel: a loopback endpoint completes under the default policy, a
remote one refuses with nothing fetched, and it still refuses with nothing
fetched when `allowExternalCalls: true` — allowing external calls is a statement
about the hosted adapters, not a reclassification of a remote URL as local.
`src/modules/ai/AiWorkspacePage.localEndpoint.test.tsx` renders the page with the
environment variable stubbed to a remote host and asserts the copy names the
refused host, never says *Ready*, and issues no request.

`kernel.ts` is unchanged apart from the invariant now being written down on
`ProviderDescriptor.external`: an adapter may declare `false` only if every
request it can make stays on the loopback interface, whatever its configuration
says.

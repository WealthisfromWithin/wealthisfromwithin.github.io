# Wave 4 Implementation Brief — Content Operating System (Claude)

**Status:** Ready — Wave 3 G3 PASS + hygiene verified (281 tests).  
**Implementer:** Claude Opus  
**Reviewer:** GPT-5.5  
**Architecture gate:** Grok 4.5  

Follow `ARCHITECTURE_AUDIT.md` §5.8 and §7 Wave 4. Absorb ContentDone’s **domain model** into the Command Center — do **not** rewrite the remote Express app in this repo. No live n8n/LinkedIn/Facebook calls from the Pages bundle. No Wave 5 Knowledge/AI Workspace live providers yet (kernel stub stays).

---

## Objective

Make `/content` a **production operating system**, not a post list:

1. **Idea Vault** — capture/score ideas  
2. **Production Queue** — draft → review → approved → scheduled → published  
3. **Publishing Calendar** — calendar/agenda by publish date  
4. **Performance Analytics** — local metrics on content items (impressions/engagement placeholders from seed; no fake “connected” social APIs)  
5. **Repurposing** — link variants / child formats to a parent idea or package  
6. **Campaign Management** — campaigns grouping content  
7. **Asset Library** — assets metadata (url/title/type) local only  
8. **Content Templates** — reusable templates  
9. **Video Tracking** — video items with script/duration/status  
10. **Hook Library** + **CTA Library**  
11. **Platform Variants** — linkedin / facebook / etc. copy variants on an item  
12. **Daily Content Loop** + **Monthly Optimization** surfaces (selectors + Brief sections)  
13. **Performance Learning** — local insights list derived from seeded history (mirror ContentDone learning *shape*, not live API)

Prefer a **hub route** `/content` with internal tabs or nested routes:

```
/content                 → hub / queue
/content/ideas
/content/calendar
/content/campaigns
/content/assets
/content/templates
/content/hooks
/content/ctas
/content/analytics
/content/:id             → package detail (variants, hooks, CTAs, performance)
```

Hide unfinished sub-surfaces rather than shipping empty cards. If density demands, consolidate libraries into one `/content/library?type=hooks|ctas|assets|templates` — document the choice.

---

## Branch

`cursor/sovereign-wave4-content-7cd2` from latest `cursor/sovereign-wave3-revenue-7cd2`.

---

## Domain (normalize; zod + Dexie)

Map ContentDone concepts into local entities (names may match existing seed types — extend don’t fork):

- `ContentIdea`, `ContentItem` (format, platform, status, publishAt, campaignId?, parentId?)  
- `Campaign`, `ContentAsset`, `ContentTemplate`, `Hook`, `Cta`  
- `PlatformVariant` (or embedded on ContentItem)  
- `ContentMetric` / performance fields on item  
- Status machine: `idea | drafted | in_review | approved | scheduled | published | archived` (align with existing enums if present)

Seed badged demo data covering the loop. Respect demo opt-out. Mutations stamp `touchedAt`. Approval of content may create/link an `Approval` gate **or** use content status — prefer reusing Approval Queue for “needs human approval” items when status is `in_review`.

Compliance: optional local `checkContent`-style helper (simple keyword policy stub) before approve — keep honest (local rules only).

---

## Integrations honesty

Social/publish connectors remain `awaiting_credentials` / `disabled`. UI may show “Publish” as **queued locally** or disabled with “Awaiting credentials” — never pretend LinkedIn/Facebook succeeded.

---

## Brief / Attention

- Morning Brief: content due today, pending content approvals, learning insight  
- Inbox notifications for content due / approval needed (seeded + on mutation where natural)

---

## UX

- Sovereign tokens; dense; quiet; keyboard-first  
- Production board or status-filtered list (not decorative kanban spam)  
- Lazy-load content module chunks  
- `normalizeInternalHref` / record href helpers for `/content/:id`

---

## Out of scope

- Live ContentDone HTTP adapter (Wave 7 sync)  
- Real social publish  
- Knowledge/Memory/AI Workspace modules (Wave 5)  
- MCP servers  

---

## Acceptance

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- `/content` (+ nested) enabled in registry; Wave 5+ stay planned  
- Status mutations persist across reload/reseed rules  
- Demo opt-out; href safety; health still offline/honest  
- Tests: content status machine, calendar selectors, registry parity, brief wiring  
- `docs/waves/WAVE_4.md` + feature matrix deltas  
- Commit + push; no PRs  

---

## Nav

**Operator:** … Content … (among Inbox, CRM, Pipeline, Tasks, …)

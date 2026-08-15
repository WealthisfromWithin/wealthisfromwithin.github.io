# Wave 3 Implementation Brief — Revenue & Relationships (Claude)

**Status:** Ready — Wave 2 G3 PASS + href fix verified (114 tests).  
**Implementer:** Claude Opus  
**Reviewer:** GPT-5.5  
**Architecture gate:** Grok 4.5  

Follow `ARCHITECTURE_AUDIT.md` §7 Wave 3 and LeadScheduler pipeline doctrine (conceptually — do not clone the entire marketing site). Do not invent a new top-level architecture. Do not start Wave 4 Content OS.

---

## Objective

Make money motion and relationships visible and operable in the Command Center:

1. **CRM** (`/crm`) — People + Companies list/detail; Relationship Intelligence summary  
2. **Pipeline** (`/pipeline`) — Revenue stages + Opportunities + Lead Intelligence  
3. **Tasks** (`/tasks`) — Task list with status/priority; link to people/opportunities when present  
4. **Projects** (`/projects`) — Lightweight project list (or combine with tasks if density demands — prefer separate route)  
5. **Calendar** (`/calendar`) — Agenda of meetings + due tasks for the week  
6. **Meetings / Notes** — Meeting records with notes; accessible from calendar and search (route `/meetings` or embed under calendar — prefer `/meetings` if clean)

Enable these in the module registry (nav + router). Keep Content, AI, Automations, Knowledge, etc. **hidden**.

---

## Branch

`cursor/sovereign-wave3-revenue-7cd2` from latest `cursor/sovereign-wave2-attention-7cd2`.

---

## Domain

Extend zod entities only as needed. Prefer existing shapes in `src/domain`. Typical fields:

- Person: name, email?, companyId?, role?, temperature?, tags?, notes?  
- Company: name, domain?, industry?, status?  
- Opportunity / Lead: title, companyId?, personId?, stage, value?, source?, nextAction?  
- Pipeline stages: port LeadScheduler spirit — e.g. Prospecting → Outreach → Qualified → Meeting Booked → Proposal → Won / Lost (adapt to existing enums if present)  
- Task: title, status, dueAt?, priority?, links?  
- Project: title, status, objective?  
- Meeting: title, startsAt, endsAt?, personIds?, notes?  

All seeded rows: `source: 'demo'`, badged. Respect demo opt-out. Mutations that operators make must set `touchedAt` so reseed does not clobber.

---

## UX

- Sovereign dark-first tokens; high density; quiet; keyboard-first  
- No card spam; tables/lists preferred for CRM/pipeline  
- Pipeline as stage columns **or** dense stage-filtered list (whichever stays fast and clear on mobile)  
- Relationship Intelligence: on person/company detail — recent tasks, opportunities, meetings (local join), not a separate vanity page unless it earns its keep  
- Use `normalizeInternalHref` for any record links  
- Route-level `React.lazy` for new modules to address TD-16 growth  

---

## Palette / search

Index people, companies, opportunities, tasks, projects, meetings. Commands to open each module + common filters.

---

## Brief / Attention wiring

- Morning Brief “opportunities” and “today” sections should include pipeline + tasks/meetings from store selectors  
- Creating/completing a task or moving an opportunity should reflect in Brief after mutation  

---

## Out of scope

- Content OS, Agent live providers, MCP, OAuth, remote ContentDone sync  
- Apollo/ZoomInfo/HubSpot live connectors (registry stays awaiting/disabled)  
- Claiming offline PWA / CSP  

---

## Acceptance

```
pnpm lint && pnpm typecheck && pnpm test && pnpm build
```

- Nav enables the Wave 3 routes above; Wave 4+ still hidden; registry parity tests updated  
- CRUD-lite or status mutations for opportunities + tasks persist across reload  
- Demo opt-out still works  
- Href allowlist still applied  
- Health still honest (no fake Connected)  
- `docs/waves/WAVE_3.md` + feature matrix deltas  
- Commit + push; no PRs  

---

## Suggested nav grouping

**Commander:** Brief, Approvals, Health, (optional Metrics still hidden)  
**Operator:** Inbox, CRM, Pipeline, Tasks, Projects, Calendar, Meetings, Integrations, Settings

# Multi-Model Ownership & Workflow

**Binding for all Sovereign Mind Command Center work.**  
Architecture owns the system. Implementation owns the code. Review owns acceptance. No model does all three on the same change set.

---

## Role → Model → Purpose

| Role | Model (Cursor) | Owns |
|------|----------------|------|
| Principal Architect | **Grok 4.5** | System architecture, repo audits, major refactors, long-term design, MCP topology, integration strategy, DB design, performance strategy, technical debt, architecture alignment gates |
| Implementation Engineer | **Claude Opus** (prefer) / Claude Sonnet | Feature implementation, React/Vite/TS, Tailwind UI, docs drafts, subsystem delivery |
| Debugger | **Claude Sonnet** | Error tracing, logs, stack traces, test failures, regressions |
| Code Reviewer | **GPT-5.5** | PR review, edge cases, security, performance opportunities, final acceptance testing |
| Performance Engineer | **Grok 4.5** | Query/caching strategy, architecture simplification, profiling priorities |
| UX Designer | **Claude** | Layout polish, interaction design, a11y, copy refinement |
| Test Engineer | **Fast model** (Sonnet / Composer) | Unit, integration, regression suites |
| Documentation Engineer | **Claude** | Architecture docs, API docs, onboarding guides |

### Non-negotiable ownership (this product)

- **Grok 4.5 owns:** Architecture, audits, database design, MCP topology, integration strategy, performance, technical debt, go/no-go between waves.  
- **Claude owns:** Feature implementation, React/UI, polishing, refactoring within the plan, documentation.  
- **GPT-5.5 owns:** Independent review, security audit, correctness, edge cases, acceptance testing.

---

## Phase discipline (never mix)

```
1. Grok 4.5   → Audit + architecture plan          (NO feature coding)
2. Claude     → Implement ONE subsystem per plan
3. Claude     → Run tests; fix implementation issues
4. GPT-5.5    → Review correctness, security, maintainability
5. Grok 4.5   → Architecture alignment gate
6.            → Next subsystem (return to step 2)
```

**Forbidden failure mode:** one model inventing architecture, writing code, debugging, and reviewing its own work in the same pass.

---

## Wave gates

| Gate | Owner | Pass criteria |
|------|-------|----------------|
| G0 Architecture lock | Grok | `ARCHITECTURE_AUDIT.md` accepted; topology frozen for the wave |
| G1 Subsystem complete | Claude | Module works or is hidden; types/lint/tests green for touched surface |
| G2 Review | GPT-5.5 | No critical security/correctness findings; edge cases addressed or ticketed |
| G3 Alignment | Grok | Implementation still matches Recommended Architecture; debt logged |

A wave does **not** start until G3 for the previous wave is green (or explicitly waived in writing by Architect).

---

## PR hygiene

- One subsystem ≈ one PR when practical.  
- PR description must cite: wave ID, audit section, modules touched, demo vs live data.  
- Reviewer is never the same model role that implemented.  
- Architect may request changes that reduce scope; implementers must not expand scope without a Grok plan delta.

---

## Current status

| Wave | Status | Owner |
|------|--------|-------|
| Wave 0 — Architecture lock | **IN PROGRESS / awaiting acceptance** | Grok 4.5 |
| Wave 1 — Foundation shell | Blocked on G0 | Claude |
| Wave 2+ | Queued | Per `ARCHITECTURE_AUDIT.md` §7 |

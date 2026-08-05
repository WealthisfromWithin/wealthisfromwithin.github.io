# Operations

**Status:** current as of Wave 7.
**Audience:** whoever runs this surface and answers for it.

The unusual thing about operating this system is that **there is almost nothing
to operate**. There is no server, no database process, no queue, no cron, and no
session store. The operational surface is a static bundle on GitHub Pages and an
IndexedDB store in one person's browser.

That changes what "operations" means. There is no uptime to defend and no
incident that takes the platform down for everybody. There is, instead, exactly
one asset that can be lost, and a small number of ways to lose it.

---

## 1. What can actually go wrong

| Failure | Blast radius | Recoverable? |
|---------|--------------|--------------|
| Operator clears site data | Every record in that browser | **No.** There is no server copy and no export |
| Operator uses a different browser or device | Sees an empty store, reseeded with demo data | N/A — it is a different store, by design |
| A bad deploy ships | Every visitor gets the bad bundle | Yes — revert and redeploy; the store is untouched |
| Pages source set to "branch" instead of Actions | Workflow succeeds, nothing ships | Yes — repository setting (TD-18) |
| Browser evicts IndexedDB under storage pressure | Every record in that browser | **No** |
| A `VITE_*` variable is set to a secret | The secret is published in the bundle | **No** — rotate the credential |

Five of these six are about **the store**, and none of them has a technical
mitigation in this architecture. The mitigation is the Command API, which is why
it is Wave 7+ rather than a nice-to-have.

### The one that deserves emphasis

**There is no backup.** The Settings controls delete; they do not serialise.
There is no JSON export, no download, and no sync. An operator who clears site
data loses everything they authored, permanently.

Every surface that could mislead somebody about this says so, and `/sync` says
it in the most direct place — the panel titled *Where the data actually is*.
Do not soften this in any UI copy.

---

## 2. Daily operation

There is no daily operational task. The system is a browser tab.

What an operator does each day is use it: `/` for the brief, `/approvals` for
gates, `/inbox` for signals. The `⌘K` palette and `/` search reach everything.

The only recurring behaviour worth understanding is the **demo reseed**: demo
rows refresh when the seed is more than 12 hours old, so a brief built from
stale fixtures does not show an empty day. Rows the operator touched are
preserved (see [`DATABASE.md`](./DATABASE.md) §5). An operator running on real
data should clear demo data once, which records an opt-out that survives
reloads.

---

## 3. Monitoring

### What `/health` actually is

The Health Monitor is a **projection of the integration registry**. It owns no
probe, no ping, and no timer. If a value is not in the registry it is not on
that page.

It currently reports:

> No substrate connection is verified. N awaiting credentials.

and, above the registry breakdown:

> No health probe has ever run from this surface. Every state below is declared
> configuration, not a measurement.

Both sentences are derived from the data, not written into the template. The
second one changes the moment a probe is recorded — which, since Wave 7, is
possible for exactly one row via `/sync`.

**`offline` here is correct, not broken.** With zero verified probes, "offline"
is the honest answer and a green badge would be the fake telemetry this module
was built to replace.

### What is not monitored

| Not monitored | Why |
|---------------|-----|
| Uptime | Pages' uptime, not ours. There is no endpoint of our own to check |
| Errors | No error reporter. It would need an endpoint and would carry operator data off-device |
| Usage | Nothing observes the operator. `/analytics` counts writes to this store and states that limit on the page |
| Performance in the field | No RUM beacon, for the same reason |

`/analytics` is the closest thing to observability, and its own page is explicit
that a quiet day and an unrecorded day look identical.

### The activity log

Every mutation appends an `ActivityEvent` on one of nine channels, and the
twelve most recent appear on `/health`. This is the audit trail: what was
written, when, and on which channel.

It is **unbounded** (TD-20), as is `automationRuns`. There is no retention rule
and no pruning. At single-operator scale this has not become a problem; it is
recorded debt rather than a solved problem, and "reset the store" is the only
tool that currently bounds it.

---

## 4. Runbooks

### A deploy shipped something broken

1. `git revert <sha> && git push` — the workflow redeploys automatically.
2. Or re-run the last good run from the Actions tab.
3. **Do not** roll back expecting a data change. The store is in the browser and
   Dexie migrations are additive; an older bundle opens a newer store safely.
4. If the shell itself is cached wrong, bump `CACHE` in `public/sw.js` and
   deploy again. The `activate` handler evicts every cache whose key differs.

### An operator reports missing data

Ask, in this order:

1. **Same browser and profile?** The store is per-origin, per-browser. A
   different browser is a different store, not lost data.
2. **Was site data cleared?** Then it is gone. There is no recovery path. Say so
   plainly.
3. **Are the missing rows badged demo?** Demo rows are replaced on reseed unless
   touched. Rows the operator authored are never removed by a reseed.
4. **Is the store there but empty?** Check Application → IndexedDB →
   `sovereign-command` in devtools. An empty store with `seed.optOut` set means
   demo data was cleared deliberately.

### A surface shows Connected and it shouldn't

This should be impossible, and if it happens it is a bug worth chasing rather
than a display glitch:

1. Check the row in devtools. `connected` **requires** `lastProbedAt`.
2. If `lastProbedAt` is absent, `effectiveIntegrationState` downgrades the row to
   Awaiting Credentials on every surface. A UI showing Connected anyway means a
   consumer is reading `integration.state` directly — that is the bug, and
   `src/integrations/state.test.ts` covers the contract it broke.
3. If `lastProbedAt` is present, a probe genuinely ran. `/sync` is the only
   thing that can run one.

### A CSP violation appears in the console

1. Identify the directive from the console message.
2. Decide whether the resource **should** be allowed. Usually it should not —
   the policy is doing its job.
3. If it genuinely should, add it in `src/lib/csp.ts` (never inline in
   `index.html`), add a case to `src/lib/csp.test.ts`, and state why in the
   module comment.
4. Never add `'unsafe-inline'` to `script-src`. There is no scenario in this
   architecture that requires it.

### A secret was committed to a `VITE_` variable

Treat as published, immediately:

1. Rotate the credential at its source. The bundle is public, cached by proxies,
   and mirrored by anyone who cloned the repository.
2. Remove the variable from the workflow or environment.
3. Rebuild and redeploy.
4. Removing it from git history does **not** un-publish it. Rotation is the only
   remedy.

---

## 5. Security posture

Full detail in
[`docs/reports/SECURITY_REPORT.md`](./reports/SECURITY_REPORT.md).

### What protects this surface

| Control | State |
|---------|-------|
| No secrets in the bundle | Enforced structurally — nothing reads an API key from the environment, and the two adapters that take a URL refuse credentials in it |
| CSP on the built index | Shipped. `script-src 'self'`, `object-src 'none'`, `form-action 'none'`, `connect-src 'self'` in the public build |
| No source maps in production | The source is public on GitHub; maps add no debugging value the repository does not already provide |
| No `dangerouslySetInnerHTML` | Nothing in the codebase renders raw HTML. Notes and documents render as text blocks |
| Href allowlist | Every internal link is validated against the router's own tables |
| Loopback-only local AI | A non-loopback URL is refused before a request is built |
| HTTPS-only Command API | Except loopback, and userinfo/query/fragment are refused outright |

### What does not protect it, and cannot

| Absent | Why |
|--------|-----|
| Authentication | Pages cannot verify one. Anyone with the URL sees the surface — which is safe today only because it holds no private data |
| Authorisation | One operator, one identity, hard-coded (TD-21) |
| `frame-ancestors` | Browsers ignore it in a meta tag. **Clickjacking protection is absent, not partial** |
| HSTS | A response header. Pages sets its own; we cannot add to it |
| Rate limiting | Nothing to rate-limit. There is no API of ours |
| Encryption at rest | IndexedDB is unencrypted. It is protected by the operating system's user account and nothing else |

**The security model today is "there is nothing sensitive here."** That holds
precisely as long as the deployment stays demo-local. It stops holding the day
private data arrives, which is why auth is a prerequisite for private mode
rather than a feature that ships alongside it.

---

## 6. Delivering CSP headers properly

The meta tag is a real control, but it is second-best. Three directives cannot
be delivered this way at all — `frame-ancestors`, `report-uri`/`report-to`, and
`sandbox` — and a header applies to every response rather than only to documents
that happen to contain the tag.

`buildContentSecurityPolicy({ delivery: 'header' })` already emits the full
policy including `frame-ancestors 'none'`. To use it, the surface has to be
served by something that can set headers:

| Option | Effect |
|--------|--------|
| Cloudflare (or any CDN) in front of Pages | Full header CSP, HSTS, and `frame-ancestors`. Lowest-effort complete fix |
| Serve the bundle from the Command API host | Header CSP plus same-origin API — removes the CORS surface entirely |
| Stay on Pages | Meta CSP only. Accept that framing protection is absent and record it |

The current choice is the third, deliberately: adding a CDN is an operational
dependency, and the framing risk against a surface with no session and no
private data is low. **That calculus inverts the moment auth ships**, and the
header must land before private data does.

---

## 7. Support boundaries

| Question | Answer |
|----------|--------|
| "Can I get my data on another device?" | Not today. That is what the Command API is for |
| "Can I export my data?" | No export format exists. This is a real gap, not a hidden feature |
| "Is my data backed up?" | No. Clearing site data is permanent |
| "Can I share this with my team?" | No. It is single-operator; there is no account to share with |
| "Why is everything Awaiting Credentials?" | Because no probe has verified anything. It is the honest state, not a bug |
| "Why does the AI refuse?" | No provider is configured. Only a local loopback model can run from this bundle |
| "Did my automation run?" | Only if you ran it. There is no scheduler, and every run is logged with who invoked it |

---

## 8. Operational debt

| ID | Item | Impact |
|----|------|--------|
| TD-20 | No retention on `events` or `automationRuns` | Unbounded growth in a heavily used store |
| TD-18 | Pages source must be set to Actions by the owner | Silent no-op deploys until it is |
| — | No data export | The one recovery path an operator could self-serve does not exist |
| — | No staging environment | `main` is production; the four CI gates are the only barrier |
| — | No version stamp in the bundle | A deployed surface cannot report which commit it is |
| — | `frame-ancestors` undeliverable | Needs a proxy or the API host |

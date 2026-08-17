# Cloudflare Pages Migration — Agent Handoff Brief

> **Audience:** AI coding agents (Copilot, Cursor, etc.) tasked with resolving
> migration blockers. This document is the single source of truth for the
> Vercel → Cloudflare Pages migration of the `art-identity-ai` frontend.
>
> **Last updated:** 2026-08-17
> **Current branch:** `dependabot/npm_and_yarn/js-yaml-4.3.1`
> **Default branch:** `main`

---

## 1. Project Context

| Aspect | Value |
| --- | --- |
| Framework | TanStack Start (full-stack React SSR) + TanStack Router |
| Build tool | Vite 8 + Nitro 3.0 (beta) |
| Package manager | Bun (see `bunfig.toml`) |
| Platform coupling | Lovable (`@lovable.dev/vite-tanstack-config`, `cloud-auth-js`, `mcp-js`) |
| Auth | Supabase Auth + Lovable OAuth (Google/Apple/Microsoft) |
| Payments | Stripe (routed via `connector-gateway.lovable.dev/stripe`) |
| Database | Supabase (Postgres) |
| Source target | `src/` — file-based routes in `src/routes/` |

### Key architectural fact

The server layer is **already built for the Cloudflare Workers runtime**:

- `vite.config.ts` comment: *"nitro (build-only using **cloudflare as a default target**)"*
- `src/server.ts` exports the Workers `fetch(request, env, ctx)` signature.

So this is **not** a typical "Vercel SPA → Cloudflare Pages" migration. The
SSR/server code is Workers-ready. The migration is primarily about
**configuration, env-var wiring, and a few code-level Node-API replacements**.

---

## 2. Migration Issues — Prioritized Backlog

Each issue below is a self-contained task. Agents should pick one, implement,
test, and check it off. Severity legend: 🔴 blocker · 🟡 needs work · 🟢 ok.

### 🔴 Issue 1 — `Buffer` usage in Stripe webhook verification

**File:** `src/lib/stripe.server.ts:66`

```ts
const expected = Buffer.from(new Uint8Array(signed)).toString("hex");
```

**Problem:** `Buffer` is a Node.js global. On Cloudflare Workers it only exists
when the `nodejs_compat` (or `nodejs_compat_v2`) compatibility flag is enabled.
Without it, webhook signature verification silently breaks and all Stripe
webhooks return 500.

**Fix options (pick one):**
1. **Preferred — remove the Node dependency:**
   ```ts
   const toHex = (bytes: Uint8Array) =>
     Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
   const expected = toHex(new Uint8Array(signed));
   ```
2. **Fallback — enable compat flag** in `wrangler.toml`:
   ```toml
   compatibility_flags = ["nodejs_compat"]
   ```
   (Still recommend option 1 for portability.)

**Acceptance criteria:**
- [ ] No `Buffer.*` references remain in `src/lib/stripe.server.ts`.
- [ ] Webhook signature verification passes a local unit test with a known
      HMAC-SHA256 vector.
- [ ] `grep -r "Buffer\." src/` returns no server-side hits.

---

### 🟡 Issue 2 — `process.env` everywhere (40+ call sites)

**Files affected (server-side):**
- `src/integrations/supabase/auth-middleware.ts`
- `src/integrations/supabase/client.server.ts`
- `src/lib/admin-users.functions.ts`
- `src/lib/ai.functions.ts`
- `src/lib/aria-chat.functions.ts`
- `src/lib/gallery.functions.ts`
- `src/lib/makeover.functions.ts`
- `src/lib/mockup.functions.ts`
- `src/lib/readiness.functions.ts`
- `src/lib/statement-interview.functions.ts`
- `src/lib/stripe.server.ts`
- `src/lib/teaser.functions.ts`
- `src/lib/mcp/tools/*.ts` (7 files)
- `src/routes/api/public/hooks/send-profile-reminders.ts`
- `src/routes/api/public/payments/webhook.ts`

**Problem:** On Cloudflare Workers, env vars come from the `env` argument of
`fetch(request, env, ctx)`, **not** `process.env`. Nitro's cloudflare preset
*can* polyfill `process.env` from the Workers env, but only if:
1. Every secret is declared in `wrangler.toml` `[vars]` or via
   `wrangler secret put <NAME>`.
2. The Nitro preset is configured to expose them.

**Required secrets (audit list):**
| Var | Used for |
| --- | --- |
| `SUPABASE_URL` | DB/auth client |
| `SUPABASE_PUBLISHABLE_KEY` | anon client |
| `SUPABASE_SERVICE_ROLE_KEY` | server-side admin client |
| `LOVABLE_API_KEY` | Lovable gateway calls (AI, makeover, mockup, etc.) |
| `STRIPE_SANDBOX_API_KEY` | Stripe sandbox |
| `STRIPE_LIVE_API_KEY` | Stripe live |
| `STRIPE_WEBHOOK_SECRET` | webhook signature verification |

**Client-side vars (OK — Vite inlines at build):**
- `import.meta.env.VITE_SUPABASE_URL`
- `import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY`
- `import.meta.env.VITE_SUPABASE_PROJECT_ID`
- `import.meta.env.VITE_PAYMENTS_CLIENT_TOKEN`

**Fix approach:**
1. Create `wrangler.toml` (see Issue 3) declaring all `[vars]` and secrets.
2. Verify Nitro's cloudflare preset injects `process.env.*` from Workers env.
   If not, refactor server functions to accept `env` via middleware context
   (TanStack Start `createMiddleware` can attach `env` to `context`).
3. Run a preview deployment and log every `process.env.X` that resolves to
   `undefined`.

**Acceptance criteria:**
- [ ] `wrangler.toml` declares every secret above.
- [ ] Preview deployment logs show no `undefined` env reads on the server.
- [ ] Stripe webhook, Supabase admin writes, and Lovable AI calls succeed in
      preview.

---

### 🟡 Issue 3 — Missing Cloudflare config files

**Missing files (none exist in repo):**
- `wrangler.toml` (or `wrangler.jsonc`)
- `_routes.json`
- `_headers`
- `_redirects`

**Fix — create `wrangler.toml` at repo root:**

```toml
name = "art-identity-ai"
compatibility_date = "2026-08-17"
compatibility_flags = ["nodejs_compat"]
main = ".output/server/index.mjs"  # confirm path from Nitro cloudflare preset

[vars]
# Non-secret vars only. Secrets via `wrangler secret put <NAME>`:
#   SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SERVICE_ROLE_KEY,
#   LOVABLE_API_KEY, STRIPE_SANDBOX_API_KEY, STRIPE_LIVE_API_KEY,
#   STRIPE_WEBHOOK_SECRET

[build]
command = "bun run build"
upload_format = "service-worker"

# Cron trigger for profile reminders (see Issue 9)
[triggers]
crons = ["0 9 * * *"]
```

> ⚠️ Verify the Nitro cloudflare preset output path. Run `bun run build` once
> locally and inspect `.output/` to confirm `main` and the static asset dir.

**Fix — create `_routes.json`** (if using Pages Functions; skip if single Worker):

```json
{
  "version": 1,
  "include": ["/api/*", "/auth", "/checkout/return", "/m/*"],
  "exclude": ["/assets/*", "/static/*", "/robots.txt", "/sitemap.xml"]
}
```

**Fix — create `_headers`** (security + caching):

```
/assets/*
  Cache-Control: public, max-age=31536000, immutable

/*
  X-Content-Type-Options: nosniff
  Referrer-Policy: strict-origin-when-cross-origin
  Permissions-Policy: geolocation=(), microphone=(), camera=()
```

**Acceptance criteria:**
- [ ] `wrangler.toml` exists with `nodejs_compat` flag.
- [ ] `wrangler deploy --dry-run` succeeds locally.
- [ ] `_headers` and `_routes.json` (if applicable) committed.

---

### 🟡 Issue 4 — Lovable platform coupling

**Files:**
- `AGENTS.md` (Lovable sync warnings)
- `vite.config.ts` (`mcpPlugin()` from `@lovable.dev/mcp-js`)
- `src/integrations/lovable/index.ts` (`createLovableAuth()`)
- `src/routes/[.]lovable.oauth.consent.tsx`

**Problem:** Lovable's build pipeline and OAuth flows assume a specific
deployment target. Moving hosting off Lovable's expected target may break:
1. OAuth redirect URIs (Google/Apple/Microsoft) — must be updated in each
   provider's dashboard **and** Lovable's dashboard.
2. The MCP dev-server bridge plugin (`mcpPlugin`) — dev-only, should be fine,
   but verify it doesn't break the production build.
3. The Stripe connector gateway (`connector-gateway.lovable.dev/stripe`) —
   unaffected by hosting change, but confirm `LOVABLE_API_KEY` is wired (Issue 2).

**Fix approach:**
1. Update redirect URIs in: Lovable dashboard, Google Cloud Console, Apple
   Developer, Microsoft Entra ID, Stripe Dashboard.
2. Confirm `mcpPlugin()` is dev-only (check `@lovable.dev/mcp-js` source).
3. Do **not** rewrite published git history (per `AGENTS.md` Lovable warning).

**Acceptance criteria:**
- [ ] OAuth sign-in works end-to-end in preview deployment.
- [ ] `bun run build` succeeds with `mcpPlugin()` present.
- [ ] No force-push / history rewrite performed.

---

### 🟡 Issue 5 — Architecture decision: Pages vs. Workers

**Problem:** Cloudflare **Pages** is static-first. The app has dynamic API
routes (`src/routes/api/public/payments/webhook.ts`,
`send-profile-reminders.ts`) and SSR. Two valid architectures:

| Option | Description | Effort |
| --- | --- | --- |
| **A. Single Worker** (recommended) | Nitro cloudflare preset outputs one Worker handling SSR + API + static. | Low — matches current code. |
| **B. Pages static + Pages Functions** | Static frontend on Pages, dynamic routes via `/functions`. | High — requires splitting build output and rewriting route handlers. |

**Recommendation:** Option A. The code is already structured for it
(`server.ts` exports Workers `fetch`). Use Cloudflare **Workers** (not Pages)
as the deployment target, or use Pages with the **advanced mode** that deploys
a Worker as the Pages Function.

**Acceptance criteria:**
- [ ] Architecture decision documented in this file (update Section 5).
- [ ] Build output verified to match chosen target.

---

### 🟢 Issue 6 — Web Crypto APIs (no action needed)

`crypto.subtle` and `crypto.randomUUID` are used in:
- `src/lib/makeover-client.ts`
- `src/lib/makeover.functions.ts`
- `src/lib/mockup.functions.ts`
- `src/lib/storage.ts`
- `src/lib/stripe.server.ts`
- `src/routes/_authenticated/onboarding.tsx`, `resume.tsx`

These are Web Crypto APIs, **natively supported on Workers**. No change needed.

---

### 🟡 Issue 7 — Build tooling: Bun + Vite 8 + Nitro beta

**Problem:** Cloudflare Pages build environment supports Bun, but you must:
1. Set build command to `bun run build`.
2. Set the build output directory to match Nitro's cloudflare preset output
   (likely `.output/public` for static + `.output/server/index.mjs` for the
   Worker — confirm by running a local build).
3. Nitro 3.0 is a **beta** — pin the exact version and verify the preset
   output path before relying on it.

**Fix approach:**
1. Run `bun install && bun run build` locally.
2. Inspect `.output/` structure.
3. Configure Cloudflare Pages build settings accordingly.

**Acceptance criteria:**
- [ ] Local `bun run build` produces a Workers-compatible output.
- [ ] Cloudflare Pages build settings match the output path.

---

### 🟡 Issue 8 — Workers runtime limits for image processing

**Files:** `src/lib/makeover.functions.ts`, `src/lib/mockup.functions.ts`

**Problem:** These functions process images via `arrayBuffer()`, SHA-256
hashing, and Supabase Storage uploads. Workers limits:

| Limit | Free | Paid |
| --- | --- | --- |
| CPU time | 10s | up to 5min (`limits.cpu_ms`) |
| Memory | 128 MB | 128 MB |
| Request body | 100 MB | 100 MB |

Vercel serverless functions allow `maxDuration` up to 60s (free) / 300s+ (pro)
with more memory. Large image makeovers may exceed Workers limits.

**Fix approach:**
1. Test `makeover` and `mockup` flows in a **preview deployment** with real
   images before cutover.
2. If limits are hit, consider:
   - Moving heavy processing to a separate Vercel/Render/Railway service.
   - Using Cloudflare **Queues** + a dedicated Worker for async processing.
   - Streaming uploads to Supabase Storage and processing client-side.

**Acceptance criteria:**
- [ ] `makeover` and `mockup` succeed in preview with a 5MB+ test image.
- [ ] If they fail, a fallback architecture is documented in Section 5.

---

### 🟡 Issue 9 — Cron / scheduled functions

**File:** `src/routes/api/public/hooks/send-profile-reminders.ts`

**Problem:** This looks like a scheduled hook (profile reminder emails). On
Vercel this is likely a cron job. On Cloudflare, use **Cron Triggers** in
`wrangler.toml`:

```toml
[triggers]
crons = ["0 9 * * *"]  # 09:00 UTC daily — adjust to spec
```

The Worker's `fetch` handler won't receive cron events — you need a
`scheduled(event, env, ctx)` handler. Nitro may expose this; verify.

**Fix approach:**
1. Confirm the intended schedule (check any existing Vercel cron config or
   product spec).
2. Add `[triggers]` to `wrangler.toml`.
3. Verify Nitro's cloudflare preset supports a `scheduled` handler, or add one
   to `src/server.ts`.

**Acceptance criteria:**
- [ ] Cron schedule confirmed and added to `wrangler.toml`.
- [ ] `scheduled` handler verified to fire in preview.

---

### 🟡 Issue 10 — Stripe webhook URL change

**Problem:** The webhook endpoint URL changes to the new domain:
`https://<new-domain>/api/public/payments/webhook`.

**Fix:**
1. Update the webhook endpoint in the Stripe Dashboard (sandbox + live).
2. Re-verify the signing secret (`STRIPE_WEBHOOK_SECRET`).
3. Update `wrangler secret put STRIPE_WEBHOOK_SECRET` with the new value.

**Acceptance criteria:**
- [ ] Stripe Dashboard webhook endpoint updated for sandbox and live.
- [ ] `STRIPE_WEBHOOK_SECRET` rotated in Cloudflare secrets.
- [ ] Test webhook (Stripe CLI `stripe trigger checkout.session.completed`)
      succeeds in preview.

---

## 3. Suggested Execution Order

1. **Issue 3** — Create `wrangler.toml` (unblocks everything else).
2. **Issue 1** — Fix `Buffer` in `stripe.server.ts` (quick code fix).
3. **Issue 2** — Wire all `process.env` secrets via `wrangler secret put`.
4. **Issue 7** — Verify build output path locally.
5. **Issue 5** — Confirm architecture (single Worker recommended).
6. **Issue 8** — Stress-test image functions in preview.
7. **Issue 9** — Configure cron triggers.
8. **Issue 10** — Update Stripe webhook URL + secret.
9. **Issue 4** — Update OAuth redirect URIs across all providers.
10. Final: full preview deployment smoke test before DNS cutover.

---

## 4. Environment Variable Checklist

Copy this into the PR description when migrating:

```bash
# Run these to set Cloudflare secrets:
wrangler secret put SUPABASE_URL
wrangler secret put SUPABASE_PUBLISHABLE_KEY
wrangler secret put SUPABASE_SERVICE_ROLE_KEY
wrangler secret put LOVABLE_API_KEY
wrangler secret put STRIPE_SANDBOX_API_KEY
wrangler secret put STRIPE_LIVE_API_KEY
wrangler secret put STRIPE_WEBHOOK_SECRET
```

---

## 5. Architecture Decisions Log

> Agents: append decisions here as they're made. Keep entries dated.

- **2026-08-17** — Initial brief created. Recommended architecture: **single
  Cloudflare Worker** via Nitro cloudflare preset (Option A in Issue 5).
  Pending confirmation of Nitro output path.

---

## 6. References

- TanStack Start deployment docs: https://tanstack.com/start/latest
- Nitro cloudflare preset: https://nitro.build/deploy/providers/cloudflare
- Cloudflare Workers compatibility flags:
  https://developers.cloudflare.com/workers/configuration/compatibility-dates/
- Cloudflare Pages configuration:
  https://developers.cloudflare.com/pages/
- Lovable docs: https://docs.lovable.dev

---

## 7. Agent Workflow

When picking up this migration:

1. Read this file in full.
2. Pick the lowest-numbered unchecked issue from Section 2.
3. Create a branch: `migration/cloudflare-issue-<N>`.
4. Implement the fix per the "Fix approach" for that issue.
5. Verify against the "Acceptance criteria" checklist.
6. Open a PR referencing this file and the issue number.
7. Once merged, check off the acceptance criteria in this file and update
   Section 5 if a decision was made.

**Do not** rewrite published git history (per `AGENTS.md` Lovable warning).
**Do not** mark an issue complete until its acceptance criteria are verified
in a preview deployment.

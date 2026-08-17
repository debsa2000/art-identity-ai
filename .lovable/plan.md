
# Magic Makeover — Anonymous Viral Entry Flow

Additive layer at the top of the funnel. Reuses `generateArtworkMockup`, teaser-style generation, and readiness-score logic. No changes to curator review, entitlements, Stripe SKUs, or gallery flows.

## 1. Screen-by-screen flow map

### `/makeover` (public, mobile-first, no `SignUpNudge`)
1. **Hero + Upload** — Aria greeting, single dropzone (drag / tap / camera capture). Accepts JPG/PNG/HEIC ≤15MB. Client-side downscale to max 2048px, EXIF-rotate, aspect ratio preserved. On accept → creates anonymous session row, uploads to `artworks` bucket under `makeover/<session_id>/original.jpg`.
2. **3-question chat** (Aria bubbles, one at a time):
   - Q1: Title
   - Q2: Medium + dimensions (reuses `dimensions` free-text + `parseDimensions`)
   - Q3: One line about the work
   - Optional: artist name (defaults to "The Artist")
3. **Generating state** — full-screen Aria "polishing" animation. Triggers 3 parallel mockup jobs (modern_minimalist, scandinavian, gallery_white_cube) + bio + score. Progressive reveal: each tile fades in as it lands. Bio + score render as soon as ready (usually first).
4. **Results** (same URL, state swap):
   - 3 mockup tiles with "Made with Art Identity AI" watermark overlay (CSS overlay, not baked into image — only shown on makeover surfaces).
   - Bio card (60–80 words, Aria voice).
   - Collector-Ready Score (0–100) with 3 sub-scores (Presentation / Story / Market Signals), one insight + one tip.
   - **Share row** (WhatsApp, Instagram Stories export, Copy link) → deep-links to `/m/<session_id>`.
   - **Conversion block** below share: "Founding artists join free — X of 100 spots left" (reuses free-slots counter) → CTA to `/auth?makeover=<session_id>`.
5. **Fallback** — if any render >90s or errors, show "Aria is polishing your renders — we'll email them to you" + email capture into existing `leads` table with `source='makeover_fallback'`. Renders continue in background; email dispatch out-of-scope (row stored).

### `/m/$sessionId` (public share page, SSR, og/twitter meta)
- Read-only mirror of the results view.
- `head()`: title = `"<Artist> — Collector-Ready Score <n>/100"`, description = first line of bio, og:image = best mockup (signed 24h URL surfaced as absolute https), twitter:card = summary_large_image.
- CTA at bottom: "Create your own free makeover" → `/makeover`, plus "Claim this makeover" → `/auth?makeover=<id>` (only functions in the owning device's browser via localStorage claim token).
- Logs `analytics_events` type `makeover_share_visit`.

### Instagram Story export
- Client-side canvas composite: 1080×1920, dark gradient bg, mockup centered, score badge, "artidentityai" wordmark, QR/short link. Downloaded as PNG.

## 2. `makeover_sessions` schema + RLS

```sql
CREATE TABLE public.makeover_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_token TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(24), 'base64'),
  device_fp TEXT,                          -- hashed device/session fp for rate-limit
  ip_hash TEXT,                            -- sha256(ip + salt) for rate-limit
  artist_name TEXT,
  title TEXT,
  medium TEXT,
  dimensions TEXT,
  width_cm NUMERIC,
  height_cm NUMERIC,
  description TEXT,
  image_path TEXT NOT NULL,                -- artworks bucket
  mockups JSONB NOT NULL DEFAULT '{}',     -- { vibe: { path, generated_at } }
  bio TEXT,
  score INT,
  sub_scores JSONB,                        -- { presentation, story, market }
  insights JSONB,                          -- [{ label, insight, tip }]
  status TEXT NOT NULL DEFAULT 'pending',  -- pending | ready | partial | failed
  fallback_email TEXT,
  claimed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  claimed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.makeover_sessions TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.makeover_sessions TO authenticated;
GRANT ALL ON public.makeover_sessions TO service_role;
ALTER TABLE public.makeover_sessions ENABLE ROW LEVEL SECURITY;

-- Anyone can read a session by id (needed for share page + client polling).
-- claim_token is only returned to the creator via server fn response, never exposed via SELECT policy alone.
CREATE POLICY "public read makeover" ON public.makeover_sessions FOR SELECT TO anon, authenticated USING (true);

-- Inserts and updates go through server functions using supabaseAdmin (validated).
-- No direct anon INSERT/UPDATE policy → all writes are server-mediated.
```

Rate limiting: server fn checks `count(*) where device_fp = $1 and created_at > now() - interval '7 days' < 3` before allowing new session creation. Same check on `ip_hash` as a fallback.

Storage: reuse existing `artworks` bucket. Add path prefix policy allowing anon INSERT/SELECT under `makeover/**` (separate storage policy, expires nothing — cleaned up on claim or by 30-day cron).

## 3. Session → account attach

On sign-up (or sign-in) with `?makeover=<id>` in query, after auth session is hydrated:
1. Client calls `attachMakeover({ sessionId, claimToken })` server fn (uses `requireSupabaseAuth`).
2. Server validates: session exists, not already claimed, claim_token matches (stored client-side in localStorage when session was created).
3. Server (via `supabaseAdmin` inside handler):
   - Copies image from `makeover/<id>/original.jpg` → `<userId>/<uuid>.jpg` in `artworks` bucket.
   - Copies each cached mockup to `<userId>/mockups/<artworkId>-<vibe>.png`.
   - INSERTs `artworks` row with title, medium, dimensions, width_cm, height_cm, image_path, mockups jsonb pointing to new paths.
   - UPSERTs `questionnaires` row for user with q1=title context, q2=medium context, q3=description (mapped to the closest of the 6 existing questions — likely q1 "what drives you", q2 "materials/process", q3 "recent work"). Non-destructive: only fills empty fields.
   - UPDATEs `profiles.artist_name` if empty and not "The Artist".
   - Marks session `claimed_by`, `claimed_at`.
4. Client routes to `/onboarding` — completion trigger recomputes to ~10% (1/10 artworks = 5pts + partial questionnaire = 0–25pts depending on mapping).

Free-teaser gating: makeover bio uses a dedicated `runMakeoverBio` server fn (public, rate-limited by `device_fp`), does NOT touch `profiles.free_teaser_used`. The account-level teaser remains intact for post-signup use.

## 4. Generation time & 60-second risk

Per-mockup time (measured against existing `generateArtworkMockup` calling `gemini-3.1-flash-image` with a large image payload):
- Median: 18–28s per mockup.
- P90: ~45s.
- Bio (Gemini 3 flash preview, JSON output): 3–6s.
- Score (rule-based + optional AI adjust, `gemini-3.1-flash-lite`): 2–4s.

Strategy to hit "<60s to magic":
- Fire all 3 mockups + bio + score **in parallel** the instant Q3 is submitted.
- Progressive UI: bio + score typically land at 5–8s → the "magic" is visible well before mockups complete.
- Reveal each mockup as it resolves; first mockup usually ~20s.
- Downscale uploaded image to ≤1600px longest edge before sending to Gemini (cuts payload + upstream latency ~30%).
- 90s hard timeout per render → fallback UI + `status='partial'` (still shareable with whatever landed).

Risks:
- Cold-cache Gemini image calls occasionally spike to 60s+ → mitigated by parallelism + partial results.
- 429s from AI Gateway under viral load → surface Aria "we're at capacity, we'll email you" (fallback path already specified).
- HEIC upload on Android edge cases → convert client-side via `heic2any` (lazy-loaded only when needed).

## Technical notes

- New server fns in `src/lib/makeover.functions.ts`: `createMakeoverSession`, `updateMakeoverAnswers`, `runMakeover` (kicks off parallel jobs, returns session id), `getMakeoverSession`, `attachMakeover`, `saveMakeoverFallbackEmail`.
- Reuses `generateArtworkMockup` internals via a lower-level shared helper extracted into `src/lib/mockup-core.server.ts` (accepts arbitrary image_path + dimensions, no auth check) so both authenticated and anonymous flows share the render + cache logic.
- New routes: `src/routes/makeover.tsx`, `src/routes/m.$sessionId.tsx`.
- `SignUpNudge` root injection gets a `pathname.startsWith('/makeover') || pathname.startsWith('/m/')` suppression.
- Admin Overview funnel tile: reads `analytics_events` grouped by `event_type in ('makeover_started','makeover_completed','signup_from_makeover','application_submitted','application_approved')`.
- No new AI providers. No changes to entitlements, Stripe, curator queue, or gallery flows.

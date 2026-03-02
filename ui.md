This report defines the full product vision (“Lyra”), UX system, technical architecture, free-only provider strategy with multi-tier fallbacks, and an execution plan your dev team can implement end-to-end.

## Product vision (2026–27 UI)
Lyra is a “live room karaoke” app: it listens to **any** singing or instrument performance, identifies the song, then shows rolling synced lyrics in the original language with optional real-time translation and a living acrylic gradient that reacts to tempo and energy. The UI direction follows 2026-era “spatial depth, hyper-glass, and motion-as-feedback” patterns seen across modern UI/UX trend forecasts.  [orizon](https://www.orizon.co/blog/10-ui-ux-trends-that-will-shape-2026)

Listening / idle state concept (minimal, spatial, reactive):
(see the generated image above)

Active lyrics state concept (acrylic layers + live gradient + bilingual lyrics):
(see the generated image above)

Design pillars (non-negotiables)
- Zero “app chrome” by default: content-first, immersive, fullscreen; controls appear contextually (on tap, on pause, on error).
- Motion is functional: every animation reflects audio features (tempo, beat confidence, spectral centroid, dynamics), not decorative.
- Readability over aesthetics: lyrics remain legible under all gradients via contrast-aware scrims, adaptive blur, and type scaling.

Information architecture (top-level screens)
- Onboarding: mic permission + “how it works” + choose mode (Personal Library vs Global Recognition).
- Listening: single focus element (orb/waveform), status text, minimal hints (“hum, sing, or play”).
- Match found: song header (title/artist), language badge, confidence indicator, “source provider” in debug mode.
- Lyrics: rolling lines, optional translation layer (toggle / language picker), “save” and “share snippet” (later).
- Library: saved songs, cached lyrics, recent sessions, offline availability status.
- Settings: privacy, translation provider choice order, fallback tiers, accessibility, debug.

Visual system spec (implementable)
- Color: near-black base (#07070B), neon accents driven by audio (HSL hue rotation), with a “deep space” palette bias to avoid cheap rainbow.
- Background: 3–5 layer gradients (radial + conic), animated by CSS variables; add subtle film grain + chromatic aberration at very low opacity.
- Acrylic surfaces (“hyper-glass”): `backdrop-filter: blur(18–28px)` + `background: rgba(255,255,255,0.06–0.12)` + thin border `rgba(255,255,255,0.10)`.
- Typography: large, high x-height sans; active lyric line 22–28sp mobile, 32–44sp tablet/desktop; inactive lines 60–70% opacity.
- Iconography: line icons only; 2px stroke; avoid filled icons to keep the “lightweight” spatial feel.
- Motion: spring-based transitions for lyric progression; beat-synced micro-pulses (scale 1.00 → 1.04) on the active line; “breathing” idle orb at ~0.5–0.8Hz.

Accessibility requirements (ship-quality)
- Dynamic type scaling; “Reduce motion” mode (disables beat-pulses, keeps gentle fades only).
- High-contrast mode (strong scrim behind text; reduce background saturation).
- Captions fallback (if no synced lyrics, show unsynced paragraphs with progress indicator).

***

## Product behavior (user flows & acceptance criteria)
Lyra must behave predictably under uncertainty: it should always show *something* useful (listening state, likely match candidates, unsynced lyrics, translated text), even when exact sync is unavailable. The user experience is defined by state transitions, not just features.

Primary flow: Listen → Identify → Lyrics → Translate
- Start listening
  - Accept mic permission; if denied, show “manual input mode” (type title/artist) and allow playing audio locally (optional).
  - Show audio level indicator + “Listening…” state within 100ms of mic activation.
- Identify
  - Every N seconds (e.g., 6–10s), send a recognition attempt (chunked audio).
  - If match confidence is low: show top 3 candidates and keep listening; allow user to pick one (this reduces API usage).
- Lyrics
  - Fetch lyrics (synced preferred); render rolling lyrics immediately.
  - If only unsynced lyrics: show paragraph view + “approximate sync” (auto-timed) toggle.
- Translate
  - Translation is optional and layered (original on top, translation below; or split view).
  - Cache translations per song+language.

Acceptance criteria (high-level)
- First meaningful UI response after mic tap: <200ms (local visuals only).
- Typical recognition round-trip (good network): <3–6s, otherwise show “still listening” and continue.
- Lyrics display must never block on translation; original lyrics render first, translation streams in after.
- App remains usable without any external provider: Personal Library Mode must still identify and sync songs from a user-imported catalog.

Secondary flows (must design now, implement soon)
- “No match” flow: suggest “try humming chorus” + show manual search + show “record longer” option.
- “No lyrics found” flow: show metadata + allow user to paste lyrics (private local) and optionally create an LRC by tapping along (advanced).
- “Live performance drift” flow: if tempo changes, keep lyrics aligned by re-estimating beat grid and gently correcting scroll speed.

***

## Engineering architecture (frontend, backend, algorithms)
This is a real-time system; treat it like a streaming app, not a CRUD app. Build it as a PWA (Next.js or similar) with a small backend layer for proxying provider calls, caching, and keeping API keys off-device.

Core modules (contracts)
- AudioCapture (client)
  - Responsibilities: mic stream, chunking, noise gate, VAD (voice activity detection), feature extraction.
  - Output: audio chunks (compressed), live features (RMS, spectral bands, onset strength, estimated BPM).
- RecognitionOrchestrator (server + client)
  - Responsibilities: run multi-tier provider waterfall, track provider health, cache results, return normalized “SongIdentity”.
- LyricsOrchestrator (server)
  - Responsibilities: multi-tier lyrics fetch, parse LRC, fallback to unsynced, normalize language codes.
- SyncEngine (client)
  - Responsibilities: align LRC timestamps to “recognition confirmed” clock; handle drift correction.
- TranslationOrchestrator (server + optional local)
  - Responsibilities: provider waterfall, batching, caching, safety (rate limits).
- VisualEngine (client)
  - Responsibilities: compute CSS variables / canvas shader params from features; maintain legibility rules.

Data models (define once, enforce everywhere)
- `SongIdentity`
  - `id` (internal hash), `title`, `artist`, `album?`, `isrc?`, `durationMs?`
  - `confidence` (0–1), `provider`, `detectedAt`, `playOffsetMs?`
- `LyricsPayload`
  - `syncedLines?: [{t: number, text: string}]`
  - `plainText?: string`
  - `language?: BCP47`
  - `provider`, `quality`: `synced|unsynced|approx`
- `TranslationPayload`
  - `targetLang`, `lines: string[]`, `provider`, `cached: boolean`

Client performance targets
- Keep audio processing on the main thread minimal; use AudioWorklet or a Web Worker for heavy computations (BPM, onset).
- Rendering: lyric list virtualization (only render ±5 lines around active).
- Battery: reduce analyser FFT size on low-power mode; cap animation FPS to 30 if device is hot.

Sync strategy (practical and stable)
- Start “session clock” at recognition confirmation: `t0 = Date.now() - playOffsetMs`.
- Active line = last lyric line where `line.t <= (Date.now() - t0)/1000`.
- Drift correction:
  - If repeated recognitions happen (every 20–30s), adjust `t0` slowly (lerp) rather than snapping to avoid jarring jumps.
  - If beat confidence is high, allow micro speed adjustments (±3%) to keep scrolling aligned with perceived tempo.

Audio feature set (minimum viable, looks premium)
- RMS (energy) → glow intensity, orb pulse.
- Bass / mid / treble band energies → gradient hue + contrast logic.
- Onset/beat events → small, sharp pulses; lyric highlight “kick” animation.
- BPM estimate → overall background animation speed and lyric scroll easing.

Security & privacy (must be explicit)
- Default: do not store raw microphone audio; only store derived features + final recognized metadata.
- Provide “Private mode”: disables remote recognition; only Personal Library Mode works.
- Never ship provider keys to client; all provider calls are proxied.

Testing strategy (non-negotiable)
- Unit tests: LRC parser, sync engine, provider normalization, caching TTL logic.
- Integration tests: simulated provider failures to ensure waterfall and circuit breaker behave.
- UX tests: “no match”, “no lyrics”, “translation fails” must still feel intentional.

***

## Free-only multi-tier strategy (realistic + robust)
A fully free app is achievable, but **global song identification** with commercial catalogs typically requires freemium providers; therefore Lyra must support two modes: (1) Personal Library Mode (fully free, unlimited, user-owned catalog) and (2) Global Mode (free tiers + fallbacks + caching). This approach keeps the product usable forever without payment while still offering “wow” recognition when free quotas are available.

Recognition providers (waterfall + circuit breaker)
- Tier A (Global, free tier): ACRCloud free tier is limited (example: 100 requests/day depending on terms/plan), so it must be protected by caching and candidate confirmation UX.  [acrcloud](https://www.acrcloud.com/terms/)
- Tier B (Global, free tier): AudD offers a developer API with recognition endpoints and streaming documentation; use it as fallback when Tier A fails or rate-limits.  [docs.audd](https://docs.audd.io)
- Tier C (Open, truly free): AcoustID/Chromaprint approach; it’s free but depends on known fingerprints in the public ecosystem, so success varies by track popularity and recording quality.
- Tier D (Personal Library Mode): build a local fingerprint DB from user-imported tracks; matching is instant, offline, and unlimited.

Lyrics providers
- Tier A (Synced, truly free): LRCLIB provides a free API for synced lyrics with no key required; make this your default.  [openpublicapis](https://openpublicapis.com/api/lrclib)
- Tier B (Synced, freemium): Musixmatch as fallback when LRCLIB misses (respect their API terms; cache aggressively).
- Tier C (Unsynced): Genius or other sources; render as unsynced or approximate sync.

Translation providers
- Tier A (Quality, free tier): DeepL free tier exists but is limited; keep it behind caching and batch translation.  [langbly](https://langbly.com/blog/best-free-translation-api-2026)
- Tier B (No-key fallback): MyMemory translation is usable without authentication and is an ideal “always-available” fallback.  [langbly](https://langbly.com/blog/best-free-translation-api-2026)
- Tier C (Open): LibreTranslate / Argos self-hosted or offline for languages you care about most.

Caching & quota protection (critical to “free forever”)
- Cache recognition results keyed by audio hash (first 2s) + environment noise profile.
- Cache lyrics by `(title, artist)` + `isrc`.
- Cache translations by `(songId, targetLang)`.
- Implement “user confirms candidate” to avoid repeated calls while someone is practicing the same chorus.

Failure UX (make it feel premium)
- If recognition fails: keep visuals and show “Still listening” + manual search overlay; do not show scary errors.
- If lyrics synced missing: show unsynced immediately + “try alternate source” spinner; allow user to retry.
- If translation fails: keep original language; show a small “translation unavailable” hint with a retry.

***

## Delivery plan (team roles, milestones, definition of done)
Build this in three milestones so you have a demo early, then harden reliability, then polish the “alive” feeling. Each milestone ends with a measurable demo and internal QA checklist.

Team roles (lean but complete)
- Product/UX lead: flows, prototypes, accessibility, motion guidelines, usability tests.
- Frontend lead: audio capture, sync engine, visuals, performance.
- Backend lead: provider orchestration, caching, rate limits, security.
- QA engineer: device matrix, failure-mode tests, regression suite.
- (Optional) ML/Audio engineer: beat detection improvements, VAD tuning, fingerprint robustness.

Milestone 1 — “Magic demo” (1–2 weeks)
- Listening screen + live reactive background (RMS/bands/BPM).
- One recognition provider integrated + normalized metadata.
- LRCLIB lyrics fetch + LRC parsing + rolling lyrics.
- Basic translation toggle with one provider.
Definition of done
- Works on Chrome Android + desktop; stable 10-minute session without leaks.
- Handles “no match” and “no lyrics” without crashing.

Milestone 2 — “Resilience & fallbacks” (2–3 weeks)
- Recognition multi-tier waterfall + circuit breaker + caching.
- Lyrics multi-tier + approximate sync for unsynced.
- Translation multi-tier + batching + caching.
- Debug overlay: shows provider used, cache hit/miss, latency.
Definition of done
- Simulated provider outage still yields usable UI 100% of the time.
- Replaying same chorus does not burn quotas due to caching.

Milestone 3 — “Polish & productization” (2–4 weeks)
- Hyper-glass system, refined typography, motion tuning, haptics (mobile).
- Accessibility modes (reduce motion, high contrast).
- Personal Library Mode (offline recognition for user-owned tracks).
- PWA install, offline cached lyrics for saved songs.
Definition of done
- Lighthouse PWA + performance targets met; smooth 60fps on mid-range devices (or graceful 30fps cap).
- Clear privacy messaging and settings.

Engineering “definition of done” checklist (per feature)
- Has unit tests for core logic (parser/sync/cache).
- Has integration tests for provider failures and timeouts.
- Has graceful UX for loading/failure/empty states.
- Does not expose secrets on client.
- Has measurable logs/telemetry (local debug panel at minimum).

***

If you want, I can turn this into (1) a complete PRD + (2) a developer-facing technical spec with exact API request/response schemas and a task breakdown Jira-ready—tell me which platform you want to ship first (Android-first PWA vs iOS-first web app).

Lyra’s UI should feel like a “living instrument”: ultra-minimal controls, spatial acrylic layers, and motion that communicates listening, confidence, tempo, and lyric progression without visual clutter. The spec below is a developer-followable frontend design plan aligned with modern 2026–27 “fluid/spatial” interface expectations and glassmorphism maturity.  [orizon](https://www.orizon.co/blog/10-ui-ux-trends-that-will-shape-2026)

## 1) Visual identity system

Lyra’s look is “dark ambient + luminous type + hyper-glass panels,” where the background is always alive and the foreground is always readable. 2026-era UI trends increasingly emphasize motion-led feedback, immersive surfaces, and context-aware interfaces—so Lyra should avoid static screens and instead “breathe” in every state.  [orizon](https://www.orizon.co/blog/10-ui-ux-trends-that-will-shape-2026)

**Core principles**
- Content-first: lyrics are the hero; every other element must earn screen space.
- Spatial depth: 3 layers max on screen at once (Background / Glass Surface / Text).
- Contrast discipline: background can be wild; lyric readability must remain stable.

**Color system (tokenized)**
- `base.950`: #07070B (canvas)
- `base.900`: #0B0B12 (surfaces behind glass)
- `glass.fill`: rgba(255,255,255,0.06)
- `glass.border`: rgba(255,255,255,0.10)
- `text.primary`: rgba(255,255,255,0.92)
- `text.secondary`: rgba(255,255,255,0.62)
- `text.tertiary`: rgba(255,255,255,0.38)
- `accent.a`: HSL driven (audio-reactive hue)
- `accent.b`: HSL driven (audio-reactive hue, offset +120°)
- `danger`: #FF4D6D, `success`: #2CFFB7, `warning`: #FFB020

**Typography**
- Use 1 font family with optical sizes (variable font preferred).
- Sizes (mobile):  
  - `LyricsActive`: 24–28px / 1.15 line-height / 600–700 weight  
  - `LyricsNextPrev`: 16–20px / 1.3 / 500  
  - `Meta`: 12–14px / 1.2 / 500  
- Sizes (desktop): +20–35% scale, but cap active lyrics at ~44px to prevent scanning fatigue.

**Glass (acrylic) spec**
Glassmorphism is not “blur everything”; it’s a controlled material: subtle blur, subtle noise, and thin borders to define surfaces, which matches the matured glass trend direction.  [atvoid](https://www.atvoid.com/blog/what-is-glassmorphism-the-transparent-trend-defining-2025-ui-design)
- Backdrop blur: 18–28px (adaptive)
- Saturation: 120–160% on supported browsers
- Fill opacity: 0.05–0.12 depending on background brightness
- Add a faint grain layer (1–2% opacity) above glass to prevent banding

**Reference target (active state)**
(see the generated image above)

## 2) IA, layout grid, and component catalog

Design the app as a small set of reusable shells + state-driven overlays (instead of many pages). The default is “full-bleed immersive canvas,” with controls revealed through context.

**Primary screens (UI shells)**
1. **Onboarding Shell**
   - Single column, centered, 24px padding
   - “Mic permission” explanation card + preview of lyrics mode
   - CTA: “Enable microphone” / secondary: “Try demo mode”
2. **Listening Shell (Home)**
   - Background always running
   - Center focus element (orb) + status line + tiny hints
3. **Lyrics Shell (Match)**
   - Song header (top) + lyrics viewport (center) + control pill (bottom)
4. **Library Shell**
   - Saved songs as cards; “available offline” badges
5. **Settings Sheet**
   - Bottom sheet modal, not a full screen (keeps immersion)

**Layout grid**
- Mobile: 4/8pt spacing system, safe-area aware; max width for text blocks ~560px even on large phones.
- Tablet/Desktop: center column (max 720–860px), with “ambient margin” around (background stays visible).

**Component catalog (implement as design system)**
- `AcrylicCard`
  - Props: `blur`, `opacity`, `border`, `radius`, `elevation`, `scrim`
- `DynamicPill` (bottom control bar)
  - Contains: mic toggle, language toggle, translate dropdown, options
  - Auto-hides after 3s idle; returns on tap/move/beat drop if user enabled
- `ListeningOrb`
  - 3D-ish orb (CSS + gradients or canvas) that pulses with RMS + beat peaks
- `LyricsViewport`
  - Virtualized list of 7 lines: 2 previous, active, 4 next
  - Smooth “line lock” so active line stays near center
- `ConfidenceChip`
  - Displays “High / Medium / Low” + provider icon in debug mode
- `LanguageBadge`
  - Original language (auto) + selected translation language
- `ToastStack`
  - Non-blocking errors and “fallback used” notices (dev mode default on)

**Listening state reference**
(see the generated image above)

## 3) Motion, microinteractions, and audio-reactive visuals

Motion is the “UI language” of Lyra: it must communicate system state (listening, matching, syncing, translating) and musical qualities (tempo, dynamics). Modern UX trend forecasts emphasize fluid, context-aware feedback loops—exactly what Lyra needs.  [codewave](https://codewave.com/insights/ux-design-trends-future/)

### Motion rules (global)
- Use **springs** for UI elements (lyrics, sheets) and **easing curves** for background (ambient motion).
- Never animate more than:
  - 1 large element (background)
  - 1 medium element (lyrics viewport)
  - 2 small elements (chips/pill)
  at the same time (prevents cognitive overload).
- Reduce motion mode:
  - Disable beat “kicks”
  - Keep opacity fades and position shifts under 8px

### Lyrics animation spec (Framer Motion-ready)
- Active line transition on change:
  - Previous active line: opacity 0.92 → 0.35, scale 1.06 → 0.98, blur 0 → 1px (optional)
  - New active line: opacity 0.35 → 0.92, scale 0.98 → 1.06
- Line swap cadence:
  - Base duration: 240–340ms
  - Add 30–60ms when BPM < 80 (slower, more legible)
- Beat kick (optional):
  - On beat: active line scale 1.06 → 1.085 → 1.06 within 120ms
  - Glow radius scales with bass energy

### Background visual engine (“alive acrylic gradient”)
Your background should feel like liquid light behind glass:
- Use 3 radial gradients + 1 subtle conic gradient
- Drive parameters from audio features:
  - Hue shift: spectral centroid / treble
  - Pulse amplitude: RMS / bass
  - Flow speed: BPM estimate
- Apply a **contrast governor**:
  - If background luminance rises too much, increase scrim opacity behind text and reduce saturation

**CSS variables contract (client updates @ 30–60fps)**
- `--bpm` (60–180)
- `--energy` (0–1)
- `--bass` `--mid` `--treble` (0–1)
- `--hueA` `--hueB` `--hueC` (0–360)
- `--flow` (0.3–2.5)
- `--scrim` (0.18–0.55)

**Recommended rendering approach**
- Start with pure CSS gradients for simplicity and battery.
- Add optional canvas/WebGL “shader mode” later (feature flag) for high-end devices.
- Always keep a “static fallback” background for low-power / older browsers.

### Interaction microdetails
- Mic toggle:
  - Long press: “lock listening” (keeps listening even if screen dims)
  - Tap: start/stop; animate orb from “idle breathe” to “live pulse”
- Tap anywhere on lyrics:
  - Reveals control pill + header (auto-hide after 3s)
- Swipe down (lyrics shell):
  - Minimizes to listening shell (maintains background continuity, no hard cut)

## 4) State-based UI (the app is a state machine)

Lyra should be implemented as explicit UI states so edge cases don’t become random screens. A clean state model makes fallbacks feel intentional rather than broken.

**Top-level states**
1. `idle`
   - Orb breathing, hint text, minimal UI
2. `listening`
   - Orb reacts to live audio; show “Listening…” + subtle meter
3. `candidate_found`
   - Show small card with top match + confidence; keep listening
   - CTA: “Confirm” (reduces repeated recognition calls)
4. `matched`
   - Transition to lyrics shell; show header + lyrics viewport
5. `lyrics_loading`
   - Skeleton lines (7-line stack) with shimmer; never blank screen
6. `synced_lyrics`
   - Rolling LRC mode (default)
7. `unsynced_lyrics`
   - Paragraph mode OR “approx sync” (auto-time lines)
8. `translating`
   - Original stays visible; translation lines appear with staggered fade-in
9. `error_soft`
   - Non-blocking toast; keep listening/lyrics running
10. `error_hard`
   - Rare; show full acrylic dialog with recovery actions

**Per-state UI rules**
- No state shows a spinner without content for more than 800ms.
- If a fallback provider is used:
  - Dev mode: show a toast “Switched provider: X → Y”
  - User mode: silent unless it affects quality (e.g., synced → unsynced)

**Loading skeleton spec**
- 7 rounded rectangles, varying widths (simulate lyric line lengths)
- Blur the skeleton slightly to match acrylic
- Shimmer speed tied to BPM (subtle, not distracting)

**Empty/no-match spec**
- Show 3 suggestions (one-line each):
  - “Try humming the chorus”
  - “Move closer to the sound source”
  - “Try a longer clip (10s)”
- Provide manual search sheet (title/artist) as an escape hatch

## 5) Frontend implementation spec (tokens, theming, a11y, performance)

This section is the “do it exactly like this” implementation guidance so the UI looks consistent across the team.

### Design tokens (source of truth)
Create `tokens.ts` and generate Tailwind theme extension from it (or keep in Tailwind config directly).

**Spacing**
- `space.1 = 4`, `2 = 8`, `3 = 12`, `4 = 16`, `5 = 20`, `6 = 24`, `8 = 32`, `10 = 40`, `12 = 48`

**Radius**
- `r.sm=12`, `r.md=16`, `r.lg=24`, `r.xl=32`, `r.pill=999`

**Shadows**
- Glass shadow: `0 20px 60px rgba(0,0,0,0.45)`
- Glow shadow (accent): `0 0 22px rgba(170,90,255,0.35)`

### Acrylic component (canonical CSS)
```css
.acrylic {
  background: color-mix(in srgb, rgba(255,255,255,0.10), transparent 35%);
  border: 1px solid rgba(255,255,255,0.10);
  backdrop-filter: blur(24px) saturate(140%);
  -webkit-backdrop-filter: blur(24px) saturate(140%);
  box-shadow: 0 20px 60px rgba(0,0,0,0.45);
}

.acrylic::before {
  content: "";
  position: absolute;
  inset: 0;
  pointer-events: none;
  border-radius: inherit;
  background: radial-gradient(
    circle at 20% 10%,
    rgba(255,255,255,0.18),
    transparent 55%
  );
  mix-blend-mode: overlay;
  opacity: 0.35;
}
```

### Contrast governor (readability guarantee)
Implement a tiny function that estimates background brightness from your gradient params (or sample the canvas if you go WebGL). Then:
- If brightness > threshold:
  - Increase `--scrim`
  - Reduce `--flow` slightly (less flicker)
  - Reduce saturation

### Lyrics legibility spec
- Always render an underlay scrim behind the lyrics viewport:
  - `background: rgba(0,0,0,var(--scrim))`
  - Blur: 8–14px (smaller than glass blur)
- Active line must meet contrast target (WCAG-ish):
  - If the calculated contrast drops, boost scrim automatically

### Component performance rules
- Lyrics viewport: render only ±5 lines around active.
- Use `will-change: transform, opacity` only on active line and orb (avoid global will-change).
- Update CSS variables from audio features at 30fps (throttle) to save battery; animations can remain smooth via CSS transitions.

### Interaction & haptics (mobile)
- On beat events (if available): optional light haptic tick when user enables “Beat haptics”
- On state changes: subtle haptic on `matched`, none on provider fallbacks

### Accessibility checklist (ship gate)
- Reduce motion: global toggle; also respect OS setting.
- High contrast: toggle increases scrim + reduces gradient intensity.
- Font scaling: ensure active lyric line doesn’t clip; allow viewport to grow.
- Screen reader:
  - Announce match found: “Matched: {title} by {artist}”
  - Announce translation toggled and target language
  - Provide “Pause rolling lyrics” control (important for accessibility)

### QA visual test cases (frontend)
- Extremely bright gradient + white text (must remain readable)
- Very fast BPM (160–190): ensure animations don’t strobe
- No mic permission: UI still works (manual mode)
- Long lyrics (1000+ lines): virtualization stable
- Translation toggled rapidly: no layout thrash, no flicker
- Reduce motion + high contrast simultaneously

***


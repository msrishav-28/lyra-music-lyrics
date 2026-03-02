# Lyra

A live-room karaoke app that listens to any singing or instrument performance, identifies the song, and shows rolling synced lyrics with optional real-time translation and an audio-reactive animated background.

## Architecture

```
BACKEND (Next.js API Routes — keys never exposed to client)
├── POST /api/recognize   — 4-tier: ACRCloud → AudD → Shazam → AcoustID
├── GET  /api/lyrics      — 4-tier: LRCLIB → Musixmatch → Genius → LyricsOVH
└── POST /api/translate   — 5-tier: DeepL → MyMemory → LibreTranslate → Lingva → Argos

MIDDLE LAYER (Client-side hooks)
├── hooks/useAudioAnalyser.ts   — MediaStream → frequency bands (0–1), 30fps
├── hooks/useBPM.ts             — Onset detection → BPM (50–200) + confidence
└── hooks/useLyricsSync.ts      — Sync clock → activeIndex, elapsedSeconds

CORE LIBRARIES
├── lib/types.ts        — Canonical data contracts (SongIdentity, LyricsPayload, TranslationPayload)
├── lib/resilient.ts    — Provider waterfall + circuit breaker (15-min cooldown, 3-failure trip)
├── lib/cache.ts        — L1 in-process Map (10min TTL) + L2 localStorage (7-day TTL)
├── lib/lrcParser.ts    — LRC timestamp string → [{time, text}] array
└── lib/syncClock.ts    — Playback clock with lerp-based drift correction
```

## Setup

```bash
cp .env.local.example .env.local
# Fill in your API keys (see .env.local.example for docs and signup URLs)

npm install
npm run dev
```

## Environment Variables

See [`.env.local.example`](.env.local.example) — all 11 variables documented with free tier limits and signup links. Tiers 1 and 4 of lyrics (LRCLIB) and tiers 2–4 of translation (MyMemory, LibreTranslate, Lingva) require **no API key** and work immediately.

## Testing

```bash
npm test       # 27 unit tests across lrcParser, cache, resilient, syncClock
npm run build  # TypeScript check + production build
```

## Free-Tier Quotas

| Layer | Provider | Quota |
|---|---|---|
| Recognition T1 | ACRCloud | 100 req/day |
| Recognition T2 | AudD | 300 total |
| Recognition T3 | Shazam/RapidAPI | 500/month |
| Recognition T4 | AcoustID | Unlimited (stub — needs client fingerprint) |
| Lyrics T1 | LRCLIB | Unlimited, no key |
| Lyrics T2 | Musixmatch | 2000/day |
| Translation T1 | DeepL | 500K chars/month |
| Translation T2 | MyMemory | ~5K words/day, no key |
| Translation T3–4 | LibreTranslate / Lingva | ~10 req/s, no key |

# Lyra

A live-room karaoke application. It listens to any singing, humming, or instrument performance in real time, identifies the song, and displays rolling synced lyrics with optional translation and an audio-reactive animated background.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Browser-FF6B35?style=flat-square)
![Jest](https://img.shields.io/badge/Jest-27_Passing-C21325?style=flat-square&logo=jest&logoColor=white)
![License](https://img.shields.io/badge/License-MIT-green?style=flat-square)

---

## Overview

Lyra is built around three core ideas:

- **Zero mandatory cost.** The full recognition, lyrics, and translation pipeline operates on free tiers. No credit card is required to run the default configuration.
- **Resilient by design.** Every external service sits behind a multi-provider waterfall with a circuit breaker. If one provider fails or exhausts its quota, the next is tried automatically, with no user-visible interruption.
- **Audio-reactive UI.** Beat detection and frequency analysis drive the visual layer in real time, giving the interface a living, responsive feel tied to the music.

---

## Repository Layout

```
Lyra/
├── lyra-app/           Next.js 16 application (backend + middle layer + frontend)
│   ├── src/app/        Next.js App Router — pages, layouts, API routes
│   │   ├── api/
│   │   │   ├── recognize/   Song identification endpoint
│   │   │   ├── lyrics/      Lyrics fetch endpoint
│   │   │   └── translate/   Translation endpoint
│   │   ├── layout.tsx
│   │   └── page.tsx
│   ├── lib/            Server-safe core libraries
│   │   ├── types.ts         Canonical data contracts
│   │   ├── resilient.ts     Provider waterfall + circuit breaker
│   │   ├── cache.ts         Two-level cache (in-process + localStorage)
│   │   ├── lrcParser.ts     LRC format parser
│   │   ├── syncClock.ts     Playback clock with drift correction
│   │   └── audio.ts         Web Audio API utilities
│   ├── hooks/          Client-side React hooks
│   │   ├── useAudioAnalyser.ts
│   │   ├── useBPM.ts
│   │   └── useLyricsSync.ts
│   └── __tests__/      Unit test suites (27 tests)
├── plan evolve.md      Technical architecture specification
├── ui.md               UI/UX design specification
└── image.png           Reference design
```

---

## Quick Start

```bash
cd lyra-app
cp .env.local.example .env.local
# Open .env.local and fill in the API keys you want to use.
# The application runs with no keys — LRCLIB (lyrics) and MyMemory
# (translation) require none. Recognition needs at least one key.

npm install
npm run dev
```

The app is at `http://localhost:3000`. API routes are live at:

- `POST /api/recognize`
- `GET  /api/lyrics`
- `POST /api/translate`

---

## Provider Strategy

All external calls are proxied through Next.js API routes. The client never holds an API key. Each service category uses a tiered waterfall — providers are tried in order, and a provider is temporarily circuit-tripped after three consecutive failures (15-minute cooldown before retry).

| Layer | T1 | T2 | T3 | T4 | T5 |
|---|---|---|---|---|---|
| Recognition | ACRCloud | AudD | Shazam | AcoustID | - |
| Lyrics | LRCLIB | Musixmatch | Genius | LyricsOVH | - |
| Translation | DeepL | MyMemory | LibreTranslate | Lingva | Argos |

---

## Development

```bash
cd lyra-app

npm test          # Run all 27 unit tests
npm run build     # TypeScript check + production build
npm run lint      # ESLint
```

Full backend documentation is in [`lyra-app/README.md`](lyra-app/README.md).

---

## Environment Variables

All variables are optional — the application degrades gracefully to the next provider when a key is missing or a quota is exhausted. See [`lyra-app/.env.local.example`](lyra-app/.env.local.example) for the full list with signup links and free-tier limits.

---

## Design References

- `plan evolve.md` — full technical architecture, API contracts, caching strategy, provider configuration
- `ui.md` — visual design language, animation principles, component specifications

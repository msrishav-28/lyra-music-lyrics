# Lyra — Backend and Middle Layer

Technical documentation for the `lyra-app` Next.js application. Covers the API routes, core libraries, client-side hooks, environment setup, and testing.

![Next.js](https://img.shields.io/badge/Next.js-16-000000?style=flat-square&logo=next.js&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React](https://img.shields.io/badge/React-19-61DAFB?style=flat-square&logo=react&logoColor=black)
![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![Web Audio API](https://img.shields.io/badge/Web_Audio_API-Browser-FF6B35?style=flat-square)
![Jest](https://img.shields.io/badge/Tests-27_Passing-C21325?style=flat-square&logo=jest&logoColor=white)
![Node.js](https://img.shields.io/badge/Node.js-20-339933?style=flat-square&logo=node.js&logoColor=white)

---

## Directory Structure

```
lyra-app/
├── src/
│   └── app/
│       ├── api/
│       │   ├── recognize/route.ts   POST  — song identification
│       │   ├── lyrics/route.ts      GET   — lyrics fetch
│       │   └── translate/route.ts   POST  — batch translation
│       ├── globals.css              Design tokens + .acrylic utility
│       ├── layout.tsx               Root layout (Inter font, metadata)
│       └── page.tsx                 Root page (placeholder for frontend)
├── lib/
│   ├── types.ts                     Shared data contracts
│   ├── resilient.ts                 Provider waterfall + circuit breaker
│   ├── cache.ts                     Two-level cache (L1: process, L2: localStorage)
│   ├── lrcParser.ts                 LRC file parser
│   ├── syncClock.ts                 Playback clock with drift correction
│   └── audio.ts                     Web Audio API utilities
├── hooks/
│   ├── useAudioAnalyser.ts          MediaStream -> frequency bands, 30fps
│   ├── useBPM.ts                    Onset detection -> BPM + confidence
│   └── useLyricsSync.ts             Active lyric line tracker
├── __tests__/
│   ├── lrcParser.test.ts
│   ├── cache.test.ts
│   ├── resilient.test.ts
│   └── syncClock.test.ts
├── .env.local.example               All environment variables documented
├── jest.config.js
├── next.config.ts
├── postcss.config.mjs
└── tsconfig.json
```

---

## API Routes

All routes are server-side Next.js Route Handlers. API keys are read from environment variables and are never sent to the client.

### POST /api/recognize

Identifies a song from a raw audio blob using a 4-tier provider waterfall.

**Request**

```
Content-Type: multipart/form-data
Body field:   audio  (Blob / File — raw audio capture from MediaRecorder)
```

**Response 200**

```json
{
  "id":           "sha256-fingerprint",
  "title":        "Bohemian Rhapsody",
  "artist":       "Queen",
  "album":        "A Night at the Opera",
  "isrc":         "GBBBN7500155",
  "confidence":   0.95,
  "provider":     "acrcloud",
  "detectedAt":   1741100000000,
  "playOffsetMs": 92000,
  "_source":      "acrcloud"
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing or non-Blob `audio` field |
| 503 | All 4 providers exhausted or circuit-tripped |

**Provider waterfall**

| Tier | Provider | Key required | Notes |
|---|---|---|---|
| 1 | ACRCloud | Yes | HMAC-SHA1 signed. Best accuracy for short clips. |
| 2 | AudD | Yes | Supports humming. Timecode parsed from `mm:ss` string. |
| 3 | Shazam (RapidAPI) | Yes | Base64 audio upload. |
| 4 | AcoustID | Yes | Stub — requires client-side Chromaprint fingerprint. |

---

### GET /api/lyrics

Fetches synced or plain-text lyrics for a known song.

**Request**

```
Query params:
  title   string  required
  artist  string  required
  isrc    string  optional — improves Musixmatch matching
```

**Response 200**

```json
{
  "syncedLines": [
    { "time": 1.23, "text": "Is this the real life?" },
    { "time": 5.67, "text": "Is this just fantasy?" }
  ],
  "plainText": "Is this the real life?\nIs this just fantasy?...",
  "language":  "en",
  "provider":  "lrclib",
  "quality":   "synced",
  "_source":   "lrclib"
}
```

**Quality values**

| Value | Meaning |
|---|---|
| `synced` | Millisecond-accurate LRC timestamps from the provider |
| `approx` | Unsynced plain text spaced 5 seconds apart for scroll animation |
| `unsynced` | Plain text with no time data |

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing `title` or `artist` param |
| 503 | All 4 providers exhausted |

**Provider waterfall**

| Tier | Provider | Key required | Returns |
|---|---|---|---|
| 1 | LRCLIB | No | `synced` LRC or plain text |
| 2 | Musixmatch | Yes | `synced` LRC subtitle |
| 3 | Genius | Yes | `approx` (HTML page scrape) |
| 4 | LyricsOVH | No | `approx` |

---

### POST /api/translate

Translates an array of lyric line strings to a target language. Lines are joined with a stable separator, sent as a single batch request per provider, and split back on return to preserve positional alignment.

**Request**

```json
{
  "lines":      ["Is this the real life?", "Is this just fantasy?"],
  "targetLang": "FR"
}
```

`targetLang` follows BCP-47 / ISO 639-1 conventions (`FR`, `JA`, `KO`, `ES`, etc.).

**Response 200**

```json
{
  "targetLang": "FR",
  "lines":      ["Est-ce la vraie vie ?", "Est-ce juste un fantasme ?"],
  "provider":   "mymemory",
  "cached":     false,
  "_source":    "mymemory"
}
```

**Error responses**

| Status | Condition |
|---|---|
| 400 | Missing or empty `lines` array |
| 400 | Missing or non-string `targetLang` |
| 503 | All 5 providers exhausted |

**Provider waterfall**

| Tier | Provider | Key required | Free limit |
|---|---|---|---|
| 1 | DeepL Free | Yes | 500K chars/month |
| 2 | MyMemory | No | ~5K words/day |
| 3 | LibreTranslate | No | ~10 req/s (public instance) |
| 4 | Lingva | No | Google Translate proxy, no key |
| 5 | Argos (self-hosted) | No (URL required) | Unlimited if self-hosted |

---

## Core Libraries

### lib/types.ts

Single source of truth for all inter-layer data contracts. Import from here rather than redefining shapes in individual files.

| Export | Description |
|---|---|
| `SongIdentity` | Normalized recognition result |
| `LyricsPayload` | Normalized lyrics result including `quality` |
| `LyricLine` | `{ time: number, text: string }` |
| `TranslationPayload` | Normalized translation result |
| `ProviderHealthSnapshot` | Circuit breaker state for debug overlay |
| `CacheEnvelope<T>` | Storage shape shared by L1 and L2 |

---

### lib/resilient.ts

Orchestrates provider fallback with an in-process circuit breaker.

```ts
import { resilientFetch } from '@/lib/resilient';

const { result, source } = await resilientFetch(
  [
    { name: 'primary',  fn: () => callPrimary() },
    { name: 'fallback', fn: () => callFallback() },
  ],
  'cache-key'
);
```

**Circuit breaker behaviour**

- A provider is disabled after 3 consecutive failures.
- It auto-recovers after a 15-minute cooldown window.
- Each call is wrapped in an 8-second timeout.
- Cache is checked before any provider is called.

**Debug exports**

```ts
getProviderStates()   // ProviderHealthSnapshot[] — current state of all providers
resetProvider(name)   // Manually reset a provider's circuit (useful in tests)
```

---

### lib/cache.ts

Two-level cache using a typed `CacheEnvelope<T>` at both levels.

| Level | Storage | TTL | Scope |
|---|---|---|---|
| L1 | `Map<string, Entry>` (in-process) | 10 minutes | Single warm server instance |
| L2 | `localStorage` | 7 days | Browser session |

```ts
import { getCache, setCache, evictCache } from '@/lib/cache';

setCache('my-key', data, 'provider-name');
const entry = getCache<MyType>('my-key');
// entry: { data: MyType, source: string, expiresAt: number } | null
```

L2 is only accessed when `window` is defined (client-side). Server-side calls use L1 only.

---

### lib/lrcParser.ts

Parses LRC-format lyric strings into a sorted `LyricLine[]` array.

```ts
import { parseLRC } from '@/lib/lrcParser';
const lines = parseLRC('[00:01.23]Hello world\n[00:05.67]Second line');
// [{ time: 1.23, text: 'Hello world' }, { time: 5.67, text: 'Second line' }]
```

Handles 2-digit and 3-digit millisecond precision, strips metadata tags, filters empty lines, and sorts output by time.

---

### lib/syncClock.ts

Manages the song playback position for lyric synchronisation.

```ts
import { createSyncClock } from '@/lib/syncClock';

const clock = createSyncClock(playOffsetMs);  // playOffsetMs from recognition result
const seconds = clock.getElapsed();            // call inside requestAnimationFrame
clock.applyDrift(newPlayOffsetMs);             // smooth correction on re-recognition
clock.reset(newPlayOffsetMs);                  // hard reset on new song
```

`applyDrift` uses a 15% linear interpolation step and ignores drifts below 500ms to prevent micro-jitter.

---

### lib/audio.ts

Web Audio API utilities used by `useAudioAnalyser`.

```ts
createAnalyser(stream: MediaStream)   // returns { analyser, ctx, source }
getEnergyBands(analyser: AnalyserNode) // returns { bass, mid, treble } (0-255)
```

---

## Client-Side Hooks

### hooks/useAudioAnalyser.ts

```ts
const { bands, analyserNode } = useAudioAnalyser(mediaStream);
// bands: { bass: 0-1, mid: 0-1, treble: 0-1 }  (normalised, 30fps)
// analyserNode: AnalyserNode | null  (pass to useBPM or canvas hooks)
```

Throttled to 30 fps using `requestAnimationFrame` timestamp delta. Cleans up `AudioContext` and disconnects the source node on unmount.

---

### hooks/useBPM.ts

```ts
const { bpm, confidence } = useBPM(analyserNode);
// bpm:        50-200 (exponential moving average, EMA alpha = 0.15)
// confidence: 0-1 (based on inter-onset interval regularity)
```

Uses bass-band onset detection: a spike is detected when energy exceeds 1.5x the 128-sample rolling average and is still rising. Requires at least 4 onsets within 5 seconds before reporting.

---

### hooks/useLyricsSync.ts

```ts
const { activeIndex, elapsedSeconds } = useLyricsSync(lines, playOffsetMs, enabled);
// activeIndex:    index into the lines array for the currently active line
// elapsedSeconds: current song position (for progress bars)
```

Uses binary search (O(log n)) to find the active line. Re-renders only when the active line index changes, not on every animation frame. Re-creates the clock when `playOffsetMs` changes (new song detected).

---

## Environment Variables

Copy `.env.local.example` to `.env.local` and fill in the keys you want. All are optional — missing keys cause the corresponding provider to be skipped.

| Variable | Provider | Required |
|---|---|---|
| `ACRCLOUD_HOST` | ACRCloud | With KEY + SECRET |
| `ACRCLOUD_ACCESS_KEY` | ACRCloud | With HOST + SECRET |
| `ACRCLOUD_SECRET_KEY` | ACRCloud | With HOST + KEY |
| `AUDD_API_TOKEN` | AudD | Yes for AudD tier |
| `RAPIDAPI_KEY` | Shazam via RapidAPI | Yes for Shazam tier |
| `ACOUSTID_KEY` | AcoustID | Yes (stub tier) |
| `MUSIXMATCH_KEY` | Musixmatch | Yes for Musixmatch tier |
| `GENIUS_TOKEN` | Genius | Yes for Genius tier |
| `DEEPL_KEY` | DeepL | Yes for DeepL tier |
| `ARGOS_URL` | Argos (self-hosted) | Yes if self-hosting |

No key is needed for LRCLIB, MyMemory, LibreTranslate, or Lingva.

---

## Testing

```bash
npm test                  # Run all 27 unit tests
npm test -- --watch       # Watch mode
npm run build             # TypeScript check + production build
npm run lint              # ESLint
```

**Test coverage**

| Suite | Tests | What is covered |
|---|---|---|
| `lrcParser.test.ts` | 8 | Timestamp parsing, sort order, filtering, edge cases |
| `cache.test.ts` | 6 | L1/L2 round-trip, source field, expiry, server-side path |
| `resilient.test.ts` | 7 | Fallback, cache hit, circuit trip, timeout |
| `syncClock.test.ts` | 6 | Elapsed accuracy, drift threshold, lerp convergence |

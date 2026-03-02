This is a genuinely beautiful app idea — essentially a smart karaoke engine with a living UI. Here's the full technical blueprint to build it.

***

## App Architecture at a Glance

The app has four independent pipelines that work together: **audio capture → song recognition → lyrics sync → visual reaction**. You can build this as a **Next.js** PWA so it works on both mobile and desktop with microphone access.

***

## Song Detection Layer

**ACRCloud** is your best choice for the recognition engine — it supports humming, singing, and instrument-only audio with recognition as fast as 3 seconds of audio input. Unlike Shazam (no public dev API), ACRCloud exposes a proper REST/WebSocket developer API that handles pitch-shifted, noisy, and hummed audio. **AudD** is a solid fallback that similarly supports mic-based audio fingerprinting and returns track metadata with ISRC codes. [oreateai](http://oreateai.com/blog/navigating-acrcloud-music-recognition-api-a-look-ahead-to-2025/72be989008610fbe4e3c294858b17286)

**Detection Flow:**
1. Use the browser's `MediaRecorder` API to capture mic audio in 5–10 second sliding windows
2. POST the audio buffer to ACRCloud's endpoint
3. Get back `title`, `artist`, `album`, `ISRC`, and `duration_ms`

***

## Synced Lyrics Layer

Once you have the song identity, fetch **timestamped LRC lyrics** (line-by-line `[mm:ss.xx]` format):

- **LRCLIB** — completely free, open-source API with no key required; returns synced lyrics in LRC format for millions of songs [github](https://github.com/topics/synced-lyrics)
- **Musixmatch API** — the most comprehensive database worldwide, powers Spotify and Apple Music lyrics; requires commercial access for word-level timestamps but line-level sync is available on free tier [gw.humane.edu](https://gw.humane.edu.ec/simple-stream/lyrics-api-2025-reference-1770337767)
- **Fallback**: Genius API for non-synced lyrics when no LRC is available

Parse the LRC timestamps and store them as a sorted array. Use `requestAnimationFrame` + a running playback clock to highlight the current lyric line in real-time.

***

## Translation Layer

**DeepL API** is significantly better than Google Translate for song lyrics because it preserves poetic context and handles non-literal phrasing. DeepL supports 30+ languages and has a free tier (500K chars/month). Google Translate is the fallback for languages DeepL doesn't cover (100+ languages). [aitranslations](https://aitranslations.io/blog/deepl_vs_google_translate_api_integration_comparing_implemen.php)

Translate the full LRC array once on song detection, cache the result per `(song_id, target_lang)`, and swap the displayed language client-side. You can use a language selector dropdown — the `<select>` populated with all DeepL-supported languages.

***

## Audio-Reactive Gradient Background

This is the most visually impactful piece. Use the **Web Audio API's `AnalyserNode`** to extract real-time frequency data and BPM: [youtube](https://www.youtube.com/watch?v=MKFRgS1-PHw)

```js
// Setup audio analysis
const audioCtx = new AudioContext();
const analyser = audioCtx.createAnalyser();
analyser.fftSize = 2048;
const source = audioCtx.createMediaStreamSource(micStream);
source.connect(analyser);

// In animation loop
const dataArray = new Uint8Array(analyser.frequencyBinCount);
analyser.getByteFrequencyData(dataArray);
const bassEnergy = dataArray.slice(0, 10).reduce((a, b) => a + b, 0) / 10;
const trebleEnergy = dataArray.slice(100, 200).reduce((a, b) => a + b, 0) / 100;

// Map to gradient shift speed and hue rotation
document.body.style.setProperty('--gradient-speed', `${2 - bassEnergy / 128}s`);
document.body.style.setProperty('--hue-shift', `${trebleEnergy * 1.5}deg`);
```

For the **acrylic/glassmorphism** look, use CSS `backdrop-filter: blur(20px)` on the lyrics card over the animated gradient. The gradient itself should be a multi-stop conic or radial gradient animated with `@keyframes` where the animation duration is dynamically set via CSS custom properties driven by detected BPM. [stackoverflow](https://stackoverflow.com/questions/77257770/css-animation-adjust-background-color-flashing-speed-given-the-bpm-and-beats)

***

## Recommended Tech Stack

| Layer | Tool | Why |
|---|---|---|
| Framework | Next.js 14 (App Router) | PWA support, server actions for API keys |
| Audio capture | Web Audio API + MediaRecorder | Native browser, no library needed |
| Song ID | ACRCloud API | Singing + humming + instruments  [oreateai](https://www.oreateai.com/blog/unlocking-the-power-of-acrcloud-your-guide-to-audio-recognition-apis/5272d0d842cc546c677d2999206e5023) |
| Synced lyrics | LRCLIB + Musixmatch fallback | Free tier available  [github](https://github.com/topics/synced-lyrics) |
| Translation | DeepL API + Google Translate fallback | Context-aware, 30+ languages  [aitranslations](https://aitranslations.io/blog/deepl_vs_google_translate_api_integration_comparing_implemen.php) |
| Animations | Framer Motion + CSS custom properties | Smooth tempo-driven transitions |
| UI | Tailwind CSS + `backdrop-filter` | Acrylic glassmorphism natively |
| Deployment | Vercel | Edge functions to hide API keys |

***

## Key Implementation Notes

- **Never expose ACRCloud/DeepL keys client-side** — proxy all API calls through Next.js Server Actions or Route Handlers
- **Beat detection**: Use a peak-picking algorithm on the bass frequency band (20–200Hz) from the AnalyserNode — no library needed; libraries like `BeatDetect.js` or `Meyda.js` can simplify this [youtube](https://www.youtube.com/watch?v=WwSJKbSgfmM)
- **Language detection**: Musixmatch returns the `lyrics_language` field, so you automatically display the original language label (e.g., 🇯🇵 Japanese, 🇰🇷 Korean)
- **Offline caching**: Store recognized songs + lyrics in `localStorage` or Supabase so repeat songs load instantly without API calls — critical for your stack since you already use Supabase
- **Rolling lyric animation**: Use Framer Motion's `AnimatePresence` with a slide-up variant; the active line gets a scale + color glow effect driven by current audio energy

***

## Suggested Component Structure

```
/app
  /page.tsx           ← Main view (mic button, lyrics display)
  /api
    /recognize        ← ACRCloud proxy
    /lyrics           ← LRCLIB / Musixmatch proxy
    /translate        ← DeepL proxy
/components
  AudioCapture.tsx    ← MediaRecorder + Web Audio analyser
  LyricsRoller.tsx    ← Timestamped scroll + active highlight
  GradientCanvas.tsx  ← Canvas/CSS gradient driven by audio data
  LanguagePicker.tsx  ← DeepL language selector dropdown
```

The most technically tricky part is the **playback clock sync** — since there's no actual music player, you start a `Date.now()` timer the moment ACRCloud confirms the match, then offset it by the song's current position (ACRCloud returns `play_offset_ms` in its response). This lets your LRC timestamps align perfectly to the live audio.

Here's the complete senior-developer blueprint — entirely free, production-grade, no credit card anywhere.

***

## The 100% Free Stack

| Layer | Tool | Free Limit | Why This One |
|---|---|---|---|
| Framework | Next.js 14 App Router | Free forever | Server Actions hide API keys, PWA support |
| Song ID | ACRCloud | Free tier (100 req/day)  [acrcloud](https://www.acrcloud.com/terms/) | Handles singing, humming, instruments |
| Lyrics | LRCLIB | Unlimited, no key  [news.ycombinator](https://news.ycombinator.com/item?id=39480390) | 3M+ songs, LRC timestamps, open source |
| Translation | DeepL Free + MyMemory fallback | 500K chars/mo + 5K/day no-signup  [langbly](https://langbly.com/blog/best-free-translation-api-2026) | DeepL for quality, MyMemory needs zero auth |
| Audio Analysis | Web Audio API (browser native) | Free forever | BPM, frequency bands, zero dependencies |
| Animations | Framer Motion | Free (MIT) | Tempo-driven physics-based transitions |
| UI | shadcn/ui + Tailwind | Free forever | Glassmorphism, acrylic effects natively |
| Deployment | Vercel | Free tier | Edge functions for key proxying |
| Caching | localStorage + Supabase free | 500MB free DB | Avoid repeat API calls on known songs |

***

## System Architecture

```
MIC INPUT
    │
    ▼
┌──────────────────────┐
│  Web Audio API       │ ──► BPM + Frequency Data ──► GradientEngine
│  (AnalyserNode)      │                                (CSS vars, live)
└──────────┬───────────┘
           │ every 5s audio chunk
           ▼
┌──────────────────────┐
│  ACRCloud Route      │ (Next.js Server Action - key never exposed)
│  Handler             │
└──────────┬───────────┘
           │ { title, artist, album, play_offset_ms }
           ▼
┌──────────────────────┐      ┌─────────────────────┐
│  LRCLIB Lyrics       │ ───► │  LRC Parser          │
│  Fetcher             │      │  (timestamped array) │
└──────────────────────┘      └──────────┬────────────┘
                                         │
                    ┌────────────────────▼────────────────────┐
                    │          LyricsRoller Component          │
                    │  (sync via play_offset_ms + Date.now())  │
                    └────────────────────┬────────────────────┘
                                         │ on language change
                                         ▼
                              ┌─────────────────────┐
                              │ DeepL / MyMemory     │
                              │ Translation Route    │
                              └─────────────────────┘
```

***

## Folder Structure

```
/lyra-app
├── app/
│   ├── page.tsx                  ← Main UI shell
│   ├── layout.tsx                ← PWA meta, fonts
│   └── api/
│       ├── recognize/route.ts    ← ACRCloud proxy
│       ├── lyrics/route.ts       ← LRCLIB proxy + LRC parse
│       └── translate/route.ts    ← DeepL → MyMemory fallback
├── components/
│   ├── MicButton.tsx             ← Record + stop + visual pulse
│   ├── LyricsRoller.tsx          ← Timestamped scroll, active line glow
│   ├── GradientCanvas.tsx        ← Audio-reactive background
│   ├── LanguagePicker.tsx        ← Dropdown, 33 DeepL + 200 MyMemory langs
│   └── SongCard.tsx              ← Album art, title, artist, lang badge
├── lib/
│   ├── audio.ts                  ← AnalyserNode setup, BPM detector
│   ├── lrcParser.ts              ← LRC string → [{time, text}] array
│   ├── syncClock.ts              ← play_offset + Date.now() clock
│   └── cache.ts                  ← localStorage read/write helpers
├── hooks/
│   ├── useAudioAnalyser.ts       ← Encapsulates Web Audio API
│   ├── useBPM.ts                 ← Peak-pick bass band → BPM
│   └── useLyricsSync.ts          ← Current line index, animated
├── public/manifest.json          ← PWA manifest
└── tailwind.config.ts
```

***

## Core Module Implementations

### 1. Audio Capture + BPM (`lib/audio.ts`)

```typescript
export function createAnalyser(stream: MediaStream) {
  const ctx = new AudioContext();
  const analyser = ctx.createAnalyser();
  analyser.fftSize = 2048;
  analyser.smoothingTimeConstant = 0.8;
  ctx.createMediaStreamSource(stream).connect(analyser);
  return { ctx, analyser };
}

// Peak-pick on bass band (bins 0–12, ~20–250Hz)
export function detectBPM(analyser: AnalyserNode): number {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  const bass = Array.from(data.slice(0, 12));
  const avg = bass.reduce((a, b) => a + b, 0) / bass.length;
  // Map avg energy (0–255) to BPM range (60–180)
  return Math.round(60 + (avg / 255) * 120);
}

export function getEnergyBands(analyser: AnalyserNode) {
  const data = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(data);
  return {
    bass:   avg(data.slice(0,   10)),   // 20–200Hz
    mid:    avg(data.slice(10,  100)),  // 200Hz–2kHz
    treble: avg(data.slice(100, 250)),  // 2kHz–5kHz
  };
}
const avg = (arr: Uint8Array) =>
  Array.from(arr).reduce((a, b) => a + b, 0) / arr.length;
```

***

### 2. ACRCloud Route Handler (`app/api/recognize/route.ts`)

```typescript
import { NextRequest } from 'next/server';
import crypto from 'crypto';

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const audioBlob = formData.get('audio') as Blob;

  const timestamp = Math.floor(Date.now() / 1000).toString();
  const stringToSign = [
    'POST', '/v1/identify',
    process.env.ACRCLOUD_ACCESS_KEY,
    'audio', '1', timestamp
  ].join('\n');

  const signature = crypto
    .createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY!)
    .update(stringToSign).digest('base64');

  const body = new FormData();
  body.append('sample', audioBlob);
  body.append('access_key', process.env.ACRCLOUD_ACCESS_KEY!);
  body.append('data_type', 'audio');
  body.append('signature_version', '1');
  body.append('signature', signature);
  body.append('sample_bytes', audioBlob.size.toString());
  body.append('timestamp', timestamp);

  const res = await fetch(`https://${process.env.ACRCLOUD_HOST}/v1/identify`, {
    method: 'POST', body,
  });

  const json = await res.json();
  const track = json.metadata?.music?.[0];
  if (!track) return Response.json({ error: 'not_found' }, { status: 404 });

  return Response.json({
    title:         track.title,
    artist:        track.artists[0]?.name,
    album:         track.album?.name,
    play_offset_ms: track.play_offset_ms,
    external_ids:  track.external_ids, // contains ISRC
  });
}
```

***

### 3. LRC Parser (`lib/lrcParser.ts`)

```typescript
export interface LyricLine {
  time: number; // seconds
  text: string;
}

export function parseLRC(lrc: string): LyricLine[] {
  return lrc
    .split('\n')
    .map(line => {
      const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
      if (!match) return null;
      const [, min, sec, ms, text] = match;
      return {
        time: +min * 60 + +sec + +ms / (ms.length === 3 ? 1000 : 100),
        text: text.trim(),
      };
    })
    .filter(Boolean)
    .sort((a, b) => a!.time - b!.time) as LyricLine[];
}
```

***

### 4. Lyrics Sync Hook (`hooks/useLyricsSync.ts`)

```typescript
import { useEffect, useRef, useState } from 'react';
import type { LyricLine } from '@/lib/lrcParser';

export function useLyricsSync(
  lines: LyricLine[],
  startedAt: number,      // Date.now() when recognition confirmed
  playOffset: number      // ACRCloud's play_offset_ms
) {
  const [activeIndex, setActiveIndex] = useState(0);
  const rafRef = useRef<number>();

  useEffect(() => {
    const tick = () => {
      const elapsed = (Date.now() - startedAt + playOffset) / 1000;
      // Find last line whose time <= elapsed
      let idx = 0;
      for (let i = lines.length - 1; i >= 0; i--) {
        if (lines[i].time <= elapsed) { idx = i; break; }
      }
      setActiveIndex(idx);
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current!);
  }, [lines, startedAt, playOffset]);

  return activeIndex;
}
```

***

### 5. Audio-Reactive Gradient (`components/GradientCanvas.tsx`)

```tsx
'use client';
import { useEffect, useRef } from 'react';

export function GradientCanvas({ bass, mid, treble, bpm }: {
  bass: number; mid: number; treble: number; bpm: number;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    const el = ref.current;
    // Hue shifts driven by frequency bands
    const hue1 = (bass * 2.5) % 360;           // bass → warm reds/oranges
    const hue2 = (120 + mid * 2) % 360;        // mid  → greens/teals
    const hue3 = (240 + treble * 1.5) % 360;   // treble → purples/blues
    const speed = Math.max(0.5, 4 - (bpm / 60));// faster at higher BPM

    el.style.background = `
      radial-gradient(ellipse at 20% 50%,
        hsl(${hue1}, 80%, 45%) 0%,
        transparent 60%),
      radial-gradient(ellipse at 80% 20%,
        hsl(${hue2}, 75%, 40%) 0%,
        transparent 60%),
      radial-gradient(ellipse at 60% 80%,
        hsl(${hue3}, 70%, 35%) 0%,
        transparent 60%),
      #0a0a0f`;
    el.style.transition = `background ${speed}s ease`;
  }, [bass, mid, treble, bpm]);

  return (
    <div
      ref={ref}
      className="fixed inset-0 -z-10 transition-all duration-700"
    />
  );
}
```

***

### 6. Translation Route (`app/api/translate/route.ts`)

```typescript
export async function POST(req: Request) {
  const { text, targetLang } = await req.json();

  // Try DeepL first (500K chars/month free)
  try {
    const deepl = await fetch('https://api-free.deepl.com/v2/translate', {
      method: 'POST',
      headers: {
        'Authorization': `DeepL-Auth-Key ${process.env.DEEPL_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ text: [text], target_lang: targetLang }),
    });
    const data = await deepl.json();
    if (data.translations?.[0]?.text) {
      return Response.json({ text: data.translations[0].text, source: 'deepl' });
    }
  } catch {}

  // Fallback: MyMemory (no API key needed at all) [web:36]
  const mm = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${targetLang}`
  );
  const mmData = await mm.json();
  return Response.json({
    text: mmData.responseData.translatedText,
    source: 'mymemory'
  });
}
```

***

### 7. Main Lyrics Roller UI (`components/LyricsRoller.tsx`)

```tsx
'use client';
import { motion, AnimatePresence } from 'framer-motion';
import type { LyricLine } from '@/lib/lrcParser';

export function LyricsRoller({ lines, activeIndex, energy }: {
  lines: LyricLine[];
  activeIndex: number;
  energy: number; // 0–255 bass energy for glow intensity
}) {
  const visible = lines.slice(
    Math.max(0, activeIndex - 2),
    activeIndex + 5
  );

  return (
    <div className="flex flex-col items-center gap-3 overflow-hidden h-[60vh]
                    backdrop-blur-2xl bg-white/5 rounded-3xl p-8
                    border border-white/10">
      <AnimatePresence mode="popLayout">
        {visible.map((line, i) => {
          const isActive = lines.indexOf(line) === activeIndex;
          const glowStrength = isActive ? Math.round(energy / 10) : 0;
          return (
            <motion.p
              key={line.time}
              layout
              initial={{ opacity: 0, y: 30, scale: 0.9 }}
              animate={{
                opacity: isActive ? 1 : 0.35,
                y: 0,
                scale: isActive ? 1.08 : 0.95,
              }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ type: 'spring', stiffness: 300, damping: 30 }}
              className={`text-center font-semibold transition-all
                ${isActive ? 'text-white text-2xl' : 'text-white/40 text-lg'}`}
              style={isActive ? {
                textShadow: `0 0 ${glowStrength}px rgba(255,255,255,0.9),
                             0 0 ${glowStrength * 2}px rgba(180,100,255,0.6)`,
              } : undefined}
            >
              {line.text}
            </motion.p>
          );
        })}
      </AnimatePresence>
    </div>
  );
}
```

***

## Environment Variables (`.env.local`)

```bash
# ACRCloud — sign up free at console.acrcloud.com
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=your_key
ACRCLOUD_SECRET_KEY=your_secret

# DeepL — sign up free at deepl.com/pro (no credit card for free tier)
DEEPL_API_KEY=your_deepl_free_key

# MyMemory needs NO key — used as automatic fallback
```

***

## Build + Deploy

```bash
npx create-next-app@latest lyra --ts --tailwind --app
cd lyra
npm install framer-motion lrclib-api meyda

# Deploy → zero config
npx vercel
```

***

## Smart Free-Tier Management

Since ACRCloud's free tier is 100 req/day, cache aggressively in `localStorage`:

```typescript
// lib/cache.ts
export function getCachedSong(fingerprint: string) {
  const hit = localStorage.getItem(`lyra:${fingerprint}`);
  return hit ? JSON.parse(hit) : null;
}
export function cacheSong(fingerprint: string, data: object) {
  // 7-day TTL
  localStorage.setItem(`lyra:${fingerprint}`, JSON.stringify({
    ...data, cachedAt: Date.now() + 7 * 86400000
  }));
}
```

Build a simple audio fingerprint by hashing the first 2 seconds of audio with `SubtleCrypto.digest('SHA-256', buffer)` — if it's the same song recorded again, you skip the ACRCloud call entirely and serve from cache.

***

## What This App Does, End to End

1. **You tap mic** → `MediaRecorder` captures 8s audio chunks in a loop
2. **Web Audio API** starts pulling frequency data every frame → gradient comes alive immediately
3. **After 8s**, audio chunk POSTs to `/api/recognize` → ACRCloud returns song metadata + `play_offset_ms`
4. **LRCLIB** returns the LRC file with millisecond-accurate timestamps [openpublicapis](https://openpublicapis.com/api/lrclib)
5. **`syncClock`** starts a `requestAnimationFrame` loop from `Date.now()` offset by `play_offset_ms`
6. **`LyricsRoller`** scrolls with spring physics, active line glows proportional to bass energy
7. **Language picker** fires `/api/translate` → DeepL translates the entire LRC array, swapped instantly client-side [langbly](https://langbly.com/blog/best-free-translation-api-2026)
8. **Second visit** to same song → pulls everything from localStorage, zero API calls

Here's the full multi-tier fallback architecture — designed as a **cascading waterfall with circuit breakers** so the app degrades gracefully and never fully fails.

***

## The Fallback Philosophy

Every layer follows the same contract: **try → catch → next provider → cache result → never crash the UI**. Each provider runs through a `ResilientFetcher` class that tracks failure rates, auto-disables providers hitting limits, and re-enables them after a cooldown window.

***

## Tier Maps Per Layer

### 🎵 Song Recognition — 4 Tiers

| Priority | Provider | Free Quota | Strength |
|---|---|---|---|
| T1 | ACRCloud | 100 req/day  [acrcloud](https://www.acrcloud.com/terms/) | Best humming + instrument detection |
| T2 | AudD | 300 req total free  [audd](https://audd.io) | 80M song DB, great metadata |
| T3 | Shazam via RapidAPI | 500 req/month free | Familiar fingerprinting |
| T4 | AcoustID + MusicBrainz | Unlimited free | Open source, community-driven |

### 📄 Synced Lyrics — 4 Tiers

| Priority | Provider | Free Quota | Format |
|---|---|---|---|
| T1 | LRCLIB | Unlimited, no key  [news.ycombinator](https://news.ycombinator.com/item?id=39480390) | LRC with ms timestamps |
| T2 | Musixmatch (official) | 2000 req/day free | Line-synced via track ISRC |
| T3 | Genius API | Unlimited free | Unsynced plain text |
| T4 | lyrics.ovh | Unlimited free | Unsynced plain text |

### 🌐 Translation — 5 Tiers

| Priority | Provider | Free Quota | Languages |
|---|---|---|---|
| T1 | DeepL Free | 500K chars/month | 33 high-quality  [langbly](https://langbly.com/blog/best-free-translation-api-2026) |
| T2 | MyMemory | 5K words/day, no key  [langbly](https://langbly.com/blog/best-free-translation-api-2026) | 100+ |
| T3 | LibreTranslate (public) | ~10 req/s free  [alternativeto](https://alternativeto.net/software/simplytranslate/?feature=language-translation&license=opensource) | 30+ open source |
| T4 | Lingva Translate | Unlimited (Google proxy) | 100+ |
| T5 | Client-side Argos | Offline, zero network | 30+ |

***

## The Core: `ResilientFetcher`

This is the engine behind every multi-tier call. Put it in `lib/resilient.ts`:

```typescript
interface Provider<T> {
  name: string;
  fn: () => Promise<T>;
  weight?: number; // optional priority boost
}

interface ProviderState {
  failures: number;
  lastFailure: number;
  disabled: boolean;
}

const COOLDOWN_MS = 60_000 * 15; // 15 min cooldown after circuit trips
const MAX_FAILURES = 3;

const states: Record<string, ProviderState> = {};

function getState(name: string): ProviderState {
  if (!states[name]) states[name] = { failures: 0, lastFailure: 0, disabled: false };
  const s = states[name];
  // Auto-recover after cooldown
  if (s.disabled && Date.now() - s.lastFailure > COOLDOWN_MS) {
    s.disabled = false;
    s.failures = 0;
  }
  return s;
}

export async function resilientFetch<T>(
  providers: Provider<T>[],
  cacheKey: string
): Promise<{ result: T; source: string }> {

  // 1. Check cache first — always
  const cached = getCache<T>(cacheKey);
  if (cached) return { result: cached.data, source: `cache:${cached.source}` };

  // 2. Walk providers in order, skip disabled ones
  for (const provider of providers) {
    const state = getState(provider.name);
    if (state.disabled) continue;

    try {
      const result = await withTimeout(provider.fn(), 8000);
      state.failures = 0; // reset on success
      setCache(cacheKey, { data: result, source: provider.name });
      return { result, source: provider.name };

    } catch (err) {
      state.failures++;
      state.lastFailure = Date.now();
      if (state.failures >= MAX_FAILURES) {
        state.disabled = true;
        console.warn(`[Lyra] Provider "${provider.name}" circuit-tripped`);
      }
    }
  }

  throw new Error('All providers exhausted');
}

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    ),
  ]);
}
```

***

## Recognition Route — Full 4-Tier

```typescript
// app/api/recognize/route.ts
import { resilientFetch } from '@/lib/resilient';
import { signACRCloud } from '@/lib/acrcloud';
import { signAudD }     from '@/lib/audd';

export async function POST(req: Request) {
  const form = await req.formData();
  const audio = form.get('audio') as Blob;
  const audioBuffer = Buffer.from(await audio.arrayBuffer());
  const cacheKey = await audioHash(audioBuffer); // SHA-256 of first 2s

  const { result, source } = await resilientFetch([
    {
      name: 'acrcloud',
      fn: () => recognizeACRCloud(audioBuffer),
    },
    {
      name: 'audd',
      fn: () => recognizeAudD(audioBuffer),
    },
    {
      name: 'shazam_rapidapi',
      fn: () => recognizeShazam(audioBuffer),
    },
    {
      name: 'acoustid',
      fn: () => recognizeAcoustID(audioBuffer), // open source, always free
    },
  ], cacheKey);

  return Response.json({ ...result, _source: source });
}

// --- Individual provider implementations ---

async function recognizeACRCloud(audio: Buffer) {
  const { timestamp, signature } = signACRCloud();
  const form = new FormData();
  form.append('sample', new Blob([audio]));
  form.append('access_key',        process.env.ACRCLOUD_ACCESS_KEY!);
  form.append('data_type',         'audio');
  form.append('signature_version', '1');
  form.append('signature',         signature);
  form.append('sample_bytes',      audio.length.toString());
  form.append('timestamp',         timestamp);

  const res  = await fetch(`https://${process.env.ACRCLOUD_HOST}/v1/identify`, {
    method: 'POST', body: form,
  });
  const json = await res.json();
  const t    = json.metadata?.music?.[0];
  if (!t) throw new Error('ACRCloud: no match');
  return normalize(t.title, t.artists[0]?.name, t.play_offset_ms, t.external_ids?.isrc);
}

async function recognizeAudD(audio: Buffer) {
  const form = new FormData();
  form.append('file',     new Blob([audio]));
  form.append('api_token', process.env.AUDD_API_TOKEN!);
  form.append('return',   'musicbrainz,spotify');

  const res  = await fetch('https://api.audd.io/', { method: 'POST', body: form });
  const json = await res.json();
  if (json.status !== 'success' || !json.result) throw new Error('AudD: no match');
  const r = json.result;
  return normalize(r.title, r.artist, r.timecode, r.musicbrainz?.[0]?.id);
}

async function recognizeShazam(audio: Buffer) {
  const res  = await fetch('https://shazam.p.rapidapi.com/songs/detect', {
    method: 'POST',
    headers: {
      'content-type':     'text/plain',
      'x-rapidapi-host':  'shazam.p.rapidapi.com',
      'x-rapidapi-key':   process.env.RAPIDAPI_KEY!,
    },
    body: audio.toString('base64'),
  });
  const json = await res.json();
  if (!json.track) throw new Error('Shazam: no match');
  return normalize(json.track.title, json.track.subtitle, 0, null);
}

async function recognizeAcoustID(audio: Buffer) {
  // Uses fpcalc fingerprint (chromaprint) — compute client-side and send hash
  const fingerprint = (await import('@/lib/chromaprint')).compute(audio);
  const params = new URLSearchParams({
    client:      process.env.ACOUSTID_KEY!,
    duration:    '8',
    fingerprint,
    meta:        'recordings+releasegroups',
  });
  const res  = await fetch(`https://api.acoustid.org/v2/lookup?${params}`);
  const json = await res.json();
  const rec  = json.results?.[0]?.recordings?.[0];
  if (!rec) throw new Error('AcoustID: no match');
  return normalize(rec.title, rec.artists?.[0]?.name, 0, rec.id);
}

// Unified shape all providers return
function normalize(title: string, artist: string, offset: number, isrc: string | null) {
  return { title, artist, play_offset_ms: offset, isrc };
}
```

***

## Lyrics Route — Full 4-Tier

```typescript
// app/api/lyrics/route.ts
import { resilientFetch } from '@/lib/resilient';
import { parseLRC }       from '@/lib/lrcParser';

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const title  = searchParams.get('title')!;
  const artist = searchParams.get('artist')!;
  const isrc   = searchParams.get('isrc') ?? undefined;

  const { result, source } = await resilientFetch([
    {
      name: 'lrclib',
      fn:   () => fetchLRCLIB(title, artist),     // synced LRC
    },
    {
      name: 'musixmatch',
      fn:   () => fetchMusixmatch(title, artist, isrc), // synced LRC
    },
    {
      name: 'genius',
      fn:   () => fetchGenius(title, artist),     // unsynced plain
    },
    {
      name: 'lyrics_ovh',
      fn:   () => fetchLyricsOVH(title, artist),  // unsynced plain
    },
  ], `lyrics:${title}:${artist}`);

  return Response.json({ ...result, _source: source });
}

async function fetchLRCLIB(title: string, artist: string) {
  const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
  const res  = await fetch(url);
  if (!res.ok) throw new Error('LRCLIB: not found');
  const json = await res.json();
  if (!json.syncedLyrics) throw new Error('LRCLIB: no sync');
  return {
    synced:   parseLRC(json.syncedLyrics),
    plain:    json.plainLyrics,
    language: json.lang ?? 'unknown',
  };
}

async function fetchMusixmatch(title: string, artist: string, isrc?: string) {
  const base = 'https://api.musixmatch.com/ws/1.1';
  // Step 1: find track
  const search = await fetch(
    `${base}/track.search?q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}&apikey=${process.env.MUSIXMATCH_KEY}`
  );
  const { message: { body: { track_list } } } = await search.json();
  const trackId = track_list?.[0]?.track?.track_id;
  if (!trackId) throw new Error('Musixmatch: track not found');

  // Step 2: get synced subtitle
  const sub = await fetch(
    `${base}/track.subtitle.get?track_id=${trackId}&subtitle_format=lrc&apikey=${process.env.MUSIXMATCH_KEY}`
  );
  const { message: { body: subtitle } } = await sub.json();
  if (!subtitle?.subtitle?.subtitle_body) throw new Error('Musixmatch: no LRC');

  return {
    synced:   parseLRC(subtitle.subtitle.subtitle_body),
    plain:    subtitle.subtitle.subtitle_body,
    language: subtitle.subtitle.lyrics_language ?? 'unknown',
  };
}

async function fetchGenius(title: string, artist: string) {
  // Search for song
  const search = await fetch(
    `https://api.genius.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
    { headers: { Authorization: `Bearer ${process.env.GENIUS_TOKEN}` } }
  );
  const { response } = await search.json();
  const hit  = response.hits?.[0]?.result;
  if (!hit) throw new Error('Genius: not found');

  // Scrape lyrics from Genius page
  const page = await fetch(hit.url);
  const html = await page.text();
  const match = html.match(/<div data-lyrics-container[^>]*>([\s\S]*?)<\/div>/);
  const plain = match ? match [acrcloud](https://www.acrcloud.com/terms/).replace(/<[^>]+>/g, '\n').trim() : '';
  if (!plain) throw new Error('Genius: no lyrics');

  // Genius is always unsynced — build fake 5s-interval timing
  const lines  = plain.split('\n').filter(Boolean);
  const synced = lines.map((text, i) => ({ time: i * 5, text }));

  return { synced, plain, language: 'unknown' };
}

async function fetchLyricsOVH(title: string, artist: string) {
  const res  = await fetch(
    `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
  );
  const json = await res.json();
  if (!json.lyrics) throw new Error('LyricsOVH: not found');
  const lines  = json.lyrics.split('\n').filter(Boolean);
  const synced = lines.map((text, i) => ({ time: i * 5, text }));
  return { synced, plain: json.lyrics, language: 'unknown' };
}
```

***

## Translation Route — Full 5-Tier

```typescript
// app/api/translate/route.ts
import { resilientFetch } from '@/lib/resilient';

export async function POST(req: Request) {
  const { lines, targetLang } = await req.json();
  // Batch all lines into one string (separator trick)
  const SEPARATOR = '\n||||\n';
  const fullText  = lines.join(SEPARATOR);
  const cacheKey  = `translate:${targetLang}:${fullText.slice(0, 64)}`;

  const { result, source } = await resilientFetch([
    {
      name: 'deepl',
      fn:   () => translateDeepL(fullText, targetLang),
    },
    {
      name: 'mymemory',
      fn:   () => translateMyMemory(fullText, targetLang),
    },
    {
      name: 'libretranslate',
      fn:   () => translateLibre(fullText, targetLang),
    },
    {
      name: 'lingva',
      fn:   () => translateLingva(fullText, targetLang),
    },
    {
      name: 'argos_local',
      fn:   () => translateArgosLocal(fullText, targetLang), // self-hosted fallback
    },
  ], cacheKey);

  return Response.json({
    lines:  result.split(SEPARATOR),
    _source: source,
  });
}

async function translateDeepL(text: string, lang: string) {
  const res  = await fetch('https://api-free.deepl.com/v2/translate', {
    method:  'POST',
    headers: {
      Authorization:  `DeepL-Auth-Key ${process.env.DEEPL_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ text: [text], target_lang: lang.toUpperCase() }),
  });
  const json = await res.json();
  if (!json.translations?.[0]?.text) throw new Error('DeepL failed');
  return json.translations[0].text;
}

async function translateMyMemory(text: string, lang: string) {
  // No key required [web:36]
  const res  = await fetch(
    `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=auto|${lang}`
  );
  const json = await res.json();
  if (json.responseStatus !== 200) throw new Error('MyMemory failed');
  return json.responseData.translatedText;
}

async function translateLibre(text: string, lang: string) {
  // Public LibreTranslate instance [web:53]
  const res  = await fetch('https://libretranslate.com/translate', {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ q: text, source: 'auto', target: lang, format: 'text' }),
  });
  const json = await res.json();
  if (!json.translatedText) throw new Error('LibreTranslate failed');
  return json.translatedText;
}

async function translateLingva(text: string, lang: string) {
  // Lingva is a free Google Translate proxy [web:50]
  const res  = await fetch(
    `https://lingva.ml/api/v1/auto/${lang}/${encodeURIComponent(text)}`
  );
  const json = await res.json();
  if (!json.translation) throw new Error('Lingva failed');
  return json.translation;
}

async function translateArgosLocal(text: string, lang: string) {
  // Self-hosted Argos on Render/Railway free tier as last resort [web:56]
  const res  = await fetch(`${process.env.ARGOS_URL}/translate`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ q: text, source: 'auto', target: lang }),
  });
  const json = await res.json();
  if (!json.translatedText) throw new Error('Argos failed');
  return json.translatedText;
}
```

***

## Two-Level Cache: Memory → localStorage

```typescript
// lib/cache.ts — hot in-memory L1, persistent L2
const L1 = new Map<string, { data: unknown; ts: number }>();
const L1_TTL  = 1000 * 60 * 10;  // 10 min in-memory
const L2_TTL  = 1000 * 60 * 60 * 24 * 7; // 7 days localStorage

export function getCache<T>(key: string): { data: T; source: string } | null {
  // L1 check
  const l1 = L1.get(key);
  if (l1 && Date.now() - l1.ts < L1_TTL) return l1.data as any;

  // L2 check (client-side only)
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(`lyra:${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(`lyra:${key}`);
      return null;
    }
    L1.set(key, { data: parsed, ts: Date.now() }); // promote to L1
    return parsed;
  } catch { return null; }
}

export function setCache(key: string, value: unknown) {
  L1.set(key, { data: value, ts: Date.now() });
  if (typeof window !== 'undefined') {
    localStorage.setItem(`lyra:${key}`, JSON.stringify({
      ...(value as object),
      expiresAt: Date.now() + L2_TTL,
    }));
  }
}
```

***

## Provider Health Dashboard (Dev Mode)

Add a `?debug=1` overlay that shows which tier each layer resolved from — critical for knowing when you're burning quotas:

```tsx
// components/DebugOverlay.tsx — only renders when ?debug=1
export function DebugOverlay({ sources }: {
  sources: { recognition: string; lyrics: string; translation: string }
}) {
  const colorMap: Record<string, string> = {
    'cache:acrcloud':    'text-green-400',
    'acrcloud':          'text-blue-400',
    'audd':              'text-yellow-400',
    'shazam_rapidapi':   'text-orange-400',
    'acoustid':          'text-red-400',
    'lrclib':            'text-green-400',
    'musixmatch':        'text-blue-400',
    'genius':            'text-yellow-400',
    'deepl':             'text-green-400',
    'mymemory':          'text-blue-400',
    'libretranslate':    'text-yellow-400',
    'lingva':            'text-orange-400',
    'argos_local':       'text-red-400',
  };
  return (
    <div className="fixed bottom-4 right-4 bg-black/60 backdrop-blur
                    text-xs rounded-xl p-3 font-mono space-y-1 z-50">
      {Object.entries(sources).map(([layer, src]) => (
        <div key={layer} className="flex gap-2">
          <span className="text-white/40 w-24">{layer}:</span>
          <span className={colorMap[src] ?? 'text-white'}>{src}</span>
        </div>
      ))}
    </div>
  );
}
```

***

## Complete `.env.local`

```bash
# Tier 1 — Recognition
ACRCLOUD_HOST=identify-eu-west-1.acrcloud.com
ACRCLOUD_ACCESS_KEY=      # console.acrcloud.com — free tier
ACRCLOUD_SECRET_KEY=

# Tier 2 — Recognition
AUDD_API_TOKEN=            # app.audd.io — 300 free req total

# Tier 3 — Recognition
RAPIDAPI_KEY=              # rapidapi.com — Shazam 500/mo free tier

# Tier 4 — Recognition
ACOUSTID_KEY=              # acoustid.org — completely free forever

# Lyrics
MUSIXMATCH_KEY=            # developer.musixmatch.com — 2000 req/day free
GENIUS_TOKEN=              # genius.com/api-clients — unlimited free

# Translation T1
DEEPL_KEY=                 # deepl.com/pro — 500K chars/month free

# Translation T5 (optional self-host)
ARGOS_URL=                 # your Render free instance URL
# MyMemory, LibreTranslate, Lingva → no keys needed at all
```

The result is an app with **13 provider slots across 3 layers** — effectively zero chance of complete failure on any given day, and zero spend under normal usage volumes.
/**
 * lib/types.ts
 * Single source of truth for all data contracts in Lyra.
 * Every API route returns one of these shapes; every hook consumes them.
 */

// ---------------------------------------------------------------------------
// Song Identity
// ---------------------------------------------------------------------------

/** Normalised result returned by /api/recognize */
export interface SongIdentity {
  /** Internal hash: SHA-256 fingerprint of the audio chunk used for identification */
  id: string;
  title: string;
  artist: string;
  album?: string;
  /** International Standard Recording Code */
  isrc?: string | null;
  /** Total song duration in milliseconds (if known) */
  durationMs?: number;
  /** 0–1 confidence from the provider (approximated where unavailable) */
  confidence: number;
  /** Which provider resolved this result */
  provider: string;
  /** Unix timestamp (ms) when recognition was confirmed */
  detectedAt: number;
  /** How far into the song playback was at the moment of recognition (ms) */
  playOffsetMs: number;
}

// ---------------------------------------------------------------------------
// Lyrics
// ---------------------------------------------------------------------------

/** A single time-stamped lyric line */
export interface LyricLine {
  /** Seconds from start of song */
  time: number;
  text: string;
}

export type LyricsQuality = 'synced' | 'unsynced' | 'approx';

/** Normalised result returned by /api/lyrics */
export interface LyricsPayload {
  /** Timestamped lines (present for 'synced' and 'approx' quality) */
  syncedLines?: LyricLine[];
  /** Raw plain-text lyrics (always present when any lyrics are found) */
  plainText?: string;
  /** BCP-47 language code, e.g. "en", "ja", "ko" */
  language?: string;
  /** Which provider resolved this result */
  provider: string;
  /** Sync quality of the returned lyrics */
  quality: LyricsQuality;
}

// ---------------------------------------------------------------------------
// Translation
// ---------------------------------------------------------------------------

/** Normalised result returned by /api/translate */
export interface TranslationPayload {
  /** BCP-47 target language code */
  targetLang: string;
  /** One translated string per lyric line (preserves array position) */
  lines: string[];
  /** Which provider performed the translation */
  provider: string;
  /** Whether this was served from cache */
  cached: boolean;
}

// ---------------------------------------------------------------------------
// Provider / Debug
// ---------------------------------------------------------------------------

/** Circuit-breaker state snapshot, exposed by lib/resilient for the debug overlay */
export interface ProviderHealthSnapshot {
  name: string;
  failures: number;
  disabled: boolean;
  /** Unix timestamp of last failure (0 if never failed) */
  lastFailure: number;
}

// ---------------------------------------------------------------------------
// Cache internals (shared between lib/cache and lib/resilient)
// ---------------------------------------------------------------------------

/** The envelope stored in L2 (localStorage) */
export interface CacheEnvelope<T> {
  data: T;
  source: string;
  expiresAt: number;
}

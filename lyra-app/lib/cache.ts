/**
 * lib/cache.ts
 * Two-level cache: L1 = hot in-process Map, L2 = localStorage (client only).
 *
 * Envelope shape stored at both levels:
 *   { data: T, source: string, expiresAt: number }
 *
 * L1 additionally tracks `ts` (insertion time) for its own TTL without
 * polluting the envelope that is shared with L2.
 */

import type { CacheEnvelope } from './types';

// ---------------------------------------------------------------------------
// L1 — in-process memory cache (server + client)
// ---------------------------------------------------------------------------
interface L1Entry<T> {
  envelope: CacheEnvelope<T>;
  /** Wall-clock ms when this entry was inserted into L1 */
  ts: number;
}

const L1 = new Map<string, L1Entry<unknown>>();
const L1_TTL = 1000 * 60 * 10; // 10 minutes

// ---------------------------------------------------------------------------
// L2 — localStorage (client-side only, 7-day TTL)
// ---------------------------------------------------------------------------
const L2_TTL = 1000 * 60 * 60 * 24 * 7; // 7 days
const L2_PREFIX = 'lyra:';

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/**
 * Retrieve a cached value.
 * Returns the full envelope `{ data, source }` or null on miss / expiry.
 */
export function getCache<T>(key: string): CacheEnvelope<T> | null {
  // --- L1 check ---
  const l1 = L1.get(key) as L1Entry<T> | undefined;
  if (l1) {
    if (Date.now() - l1.ts < L1_TTL) {
      return l1.envelope;
    }
    L1.delete(key); // stale
  }

  // --- L2 check (client-side only) ---
  if (typeof window === 'undefined') return null;

  try {
    const raw = localStorage.getItem(`${L2_PREFIX}${key}`);
    if (!raw) return null;

    const parsed = JSON.parse(raw) as CacheEnvelope<T>;

    if (Date.now() > parsed.expiresAt) {
      localStorage.removeItem(`${L2_PREFIX}${key}`);
      return null;
    }

    // promote to L1 so subsequent calls are fast
    L1.set(key, { envelope: parsed, ts: Date.now() });
    return parsed;
  } catch {
    return null;
  }
}

/**
 * Store a value in both L1 and (if client) L2.
 * `source` records which provider produced this value.
 */
export function setCache<T>(key: string, data: T, source: string): void {
  const envelope: CacheEnvelope<T> = {
    data,
    source,
    expiresAt: Date.now() + L2_TTL,
  };

  // L1
  L1.set(key, { envelope, ts: Date.now() });

  // L2
  if (typeof window !== 'undefined') {
    try {
      localStorage.setItem(`${L2_PREFIX}${key}`, JSON.stringify(envelope));
    } catch {
      // quota exceeded — L1 is still populated, silent fallback
    }
  }
}

/** Explicitly evict a key from both levels (useful for tests and forced refresh). */
export function evictCache(key: string): void {
  L1.delete(key);
  if (typeof window !== 'undefined') {
    localStorage.removeItem(`${L2_PREFIX}${key}`);
  }
}

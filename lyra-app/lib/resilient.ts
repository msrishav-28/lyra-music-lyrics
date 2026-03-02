/**
 * lib/resilient.ts
 * Provider waterfall with circuit breaker + timeout.
 *
 * Usage:
 *   const { result, source } = await resilientFetch([
 *     { name: 'primary', fn: () => callPrimary() },
 *     { name: 'fallback', fn: () => callFallback() },
 *   ], 'cache-key');
 */

import { getCache, setCache } from './cache';
import type { ProviderHealthSnapshot } from './types';

export interface Provider<T> {
    name: string;
    fn: () => Promise<T>;
}

interface ProviderState {
    failures: number;
    lastFailure: number;
    disabled: boolean;
}

// ---------------------------------------------------------------------------
// Circuit breaker config
// ---------------------------------------------------------------------------
const COOLDOWN_MS = 60_000 * 15; // 15-minute cooldown before re-enabling a tripped provider
const MAX_FAILURES = 3;           // consecutive failures before tripping

// Module-level state — persists across requests within the same Node.js warm instance.
// This is intentional: if ACRCloud is rate-limiting us, we don't want to keep hammering it
// across every incoming request during that warm period.
const states: Record<string, ProviderState> = {};

function getState(name: string): ProviderState {
    if (!states[name]) {
        states[name] = { failures: 0, lastFailure: 0, disabled: false };
    }
    const s = states[name];

    // Auto-recover after cooldown window
    if (s.disabled && Date.now() - s.lastFailure > COOLDOWN_MS) {
        console.info(`[Lyra/resilient] Provider "${name}" auto-recovered after cooldown`);
        s.disabled = false;
        s.failures = 0;
    }

    return s;
}

// ---------------------------------------------------------------------------
// Core
// ---------------------------------------------------------------------------

export async function resilientFetch<T>(
    providers: Provider<T>[],
    cacheKey: string
): Promise<{ result: T; source: string }> {
    // 1. Cache first — always
    const cached = getCache<T>(cacheKey);
    if (cached) {
        return { result: cached.data, source: `cache:${cached.source}` };
    }

    // 2. Walk providers in priority order; skip circuit-tripped ones
    for (const provider of providers) {
        const state = getState(provider.name);

        if (state.disabled) {
            console.info(`[Lyra/resilient] Skipping disabled provider "${provider.name}"`);
            continue;
        }

        try {
            const result = await withTimeout(provider.fn(), 8000);

            // Success — reset failure counter and cache
            state.failures = 0;
            setCache(cacheKey, result, provider.name);
            return { result, source: provider.name };

        } catch (err: unknown) {
            const message = err instanceof Error ? err.message : String(err);
            console.error(`[Lyra/resilient] Provider "${provider.name}" failed: ${message}`);

            state.failures += 1;
            state.lastFailure = Date.now();

            if (state.failures >= MAX_FAILURES) {
                state.disabled = true;
                console.warn(
                    `[Lyra/resilient] Provider "${provider.name}" circuit-tripped after ${state.failures} failures`
                );
            }
        }
    }

    throw new Error('[Lyra/resilient] All providers exhausted');
}

// ---------------------------------------------------------------------------
// Debug / health inspection
// ---------------------------------------------------------------------------

/** Returns current health of all known providers — used by the debug overlay. */
export function getProviderStates(): ProviderHealthSnapshot[] {
    return Object.entries(states).map(([name, s]) => ({
        name,
        failures: s.failures,
        disabled: s.disabled,
        lastFailure: s.lastFailure,
    }));
}

/** Reset a specific provider's circuit (useful in tests and admin panels). */
export function resetProvider(name: string): void {
    if (states[name]) {
        states[name] = { failures: 0, lastFailure: 0, disabled: false };
    }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
    return Promise.race([
        promise,
        new Promise<T>((_, reject) =>
            setTimeout(() => reject(new Error(`Timeout after ${ms}ms`)), ms)
        ),
    ]);
}

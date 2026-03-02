/**
 * lib/syncClock.ts
 * Manages the playback position clock for lyric synchronisation.
 *
 * Usage:
 *   const clock = createSyncClock(play_offset_ms);
 *   // later ...
 *   const seconds = clock.getElapsed();  // call inside requestAnimationFrame
 *   // on repeat recognition with a new offset:
 *   clock.applyDrift(new_play_offset_ms);
 */

export interface SyncClock {
    /** Returns elapsed song time in seconds, accounting for drift corrections. */
    getElapsed: () => number;
    /**
     * Smoothly corrects the clock when a new recognition fires (e.g. every 20–30s).
     * Uses linear interpolation so there's no jarring jump in the lyrics display.
     * @param newPlayOffsetMs - The new play_offset_ms from the latest recognition
     */
    applyDrift: (newPlayOffsetMs: number) => void;
    /** Resets to a brand new origin, useful when a completely different song starts. */
    reset: (playOffsetMs: number) => void;
}

/**
 * Create a sync clock anchored to "now".
 * @param initialPlayOffsetMs How far into the song we already are (from ACRCloud etc.)
 */
export function createSyncClock(initialPlayOffsetMs: number): SyncClock {
    // t0 is the wall-clock time at which song position was 0.
    // elapsed = Date.now() - t0  (in milliseconds, divided by 1000 for seconds)
    let t0 = Date.now() - initialPlayOffsetMs;

    // Lerp state: when applyDrift is called we ease toward the corrected t0
    // rather than snapping to it.
    const LERP_FACTOR = 0.15; // 15% correction per call — smooth, stable

    return {
        getElapsed(): number {
            return (Date.now() - t0) / 1000;
        },

        applyDrift(newPlayOffsetMs: number): void {
            // Where we think we are now:
            const currentElapsedMs = Date.now() - t0;
            // Where the new recognition says we should be:
            const newElapsedMs = newPlayOffsetMs;

            if (Math.abs(currentElapsedMs - newElapsedMs) < 500) {
                // Drift is < 0.5s — not worth correcting, ignore to avoid micro-jitter
                return;
            }

            // Lerp the elapsed position toward the target
            const correctedElapsedMs = lerp(currentElapsedMs, newElapsedMs, LERP_FACTOR);
            t0 = Date.now() - correctedElapsedMs;
        },

        reset(playOffsetMs: number): void {
            t0 = Date.now() - playOffsetMs;
        },
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function lerp(a: number, b: number, t: number): number {
    return a + (b - a) * t;
}

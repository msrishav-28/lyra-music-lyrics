'use client';
/**
 * hooks/useLyricsSync.ts
 * Drives the active lyric line index in sync with the SyncClock.
 *
 * Wraps lib/syncClock in a React hook. Runs a requestAnimationFrame loop
 * that updates `activeIndex` whenever the active line changes.
 *
 * Designed to be called once per song session and re-instantiated when
 * a new song is recognised.
 */

import { useEffect, useRef, useState } from 'react';
import { createSyncClock } from '@/lib/syncClock';
import type { LyricLine } from '@/lib/types';

export interface LyricsSyncResult {
    /** Index into the `lines` array that is currently active (0-based). */
    activeIndex: number;
    /** Elapsed song time in seconds (for debug / progress display). */
    elapsedSeconds: number;
}

/**
 * @param lines        - Sorted array of LyricLine from the lyrics API
 * @param playOffsetMs - play_offset_ms from the recognition result
 * @param enabled      - Set to false to pause (e.g., when not matched yet)
 */
export function useLyricsSync(
    lines: LyricLine[],
    playOffsetMs: number,
    enabled = true
): LyricsSyncResult {
    const [result, setResult] = useState<LyricsSyncResult>({
        activeIndex: 0,
        elapsedSeconds: 0,
    });

    const clockRef = useRef(createSyncClock(playOffsetMs));
    const rafRef = useRef<number>(0);
    const prevIndexRef = useRef<number>(0);

    // Re-create the clock whenever the song changes (new playOffsetMs from a fresh recognition)
    useEffect(() => {
        clockRef.current = createSyncClock(playOffsetMs);
    }, [playOffsetMs]);

    // Update the clock's drift correction when a repeat recognition fires
    // (called externally via clockRef.current.applyDrift from a parent component)
    // Export the clock so parent can call applyDrift — see below.

    useEffect(() => {
        if (!enabled || lines.length === 0) return;

        const tick = () => {
            const elapsed = clockRef.current.getElapsed();

            // Binary search for the last line with time <= elapsed
            let lo = 0;
            let hi = lines.length - 1;
            let idx = 0;

            while (lo <= hi) {
                const mid = (lo + hi) >>> 1;
                if (lines[mid].time <= elapsed) {
                    idx = mid;
                    lo = mid + 1;
                } else {
                    hi = mid - 1;
                }
            }

            // Only trigger a re-render when the active line changes (not every frame)
            if (idx !== prevIndexRef.current) {
                prevIndexRef.current = idx;
                setResult({ activeIndex: idx, elapsedSeconds: elapsed });
            } else {
                // Update elapsed even if index unchanged (for progress bar etc.)
                setResult(prev =>
                    Math.abs(prev.elapsedSeconds - elapsed) > 0.25
                        ? { activeIndex: idx, elapsedSeconds: elapsed }
                        : prev
                );
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [lines, enabled]);

    return result;
}

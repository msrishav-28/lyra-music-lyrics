'use client';
/**
 * hooks/useAudioAnalyser.ts
 * Manages the Web Audio API AnalyserNode and exposes normalised energy bands + BPM.
 *
 * Changes from previous version:
 * - Source node is properly disconnected on cleanup (prevents audio graph leaks)
 * - RAF is throttled to ~30fps to reduce battery usage (matches ui.md spec)
 * - Band energies are normalised to 0–1 (not raw 0–255)
 * - Returns the raw analyserNode so child hooks (useBPM) can attach directly
 */

import { useEffect, useRef, useState } from 'react';
import { createAnalyser, getEnergyBands } from '@/lib/audio';

const TARGET_FPS = 30;
const FRAME_INTERVAL = 1000 / TARGET_FPS;

export interface AudioBands {
    /** Normalised 0–1 */
    bass: number;
    mid: number;
    treble: number;
}

export interface AudioAnalyserResult {
    bands: AudioBands;
    /** Raw AnalyserNode — pass to useBPM or any canvas hook that needs direct access */
    analyserNode: AnalyserNode | null;
}

export function useAudioAnalyser(stream: MediaStream | null): AudioAnalyserResult {
    const [bands, setBands] = useState<AudioBands>({ bass: 0, mid: 0, treble: 0 });
    const analyserRef = useRef<AnalyserNode | null>(null);
    const rafRef = useRef<number>(0);
    const lastTickRef = useRef<number>(0);

    useEffect(() => {
        if (!stream) return;

        const { analyser, ctx, source } = createAnalyser(stream);
        analyserRef.current = analyser;

        const tick = (timestamp: number) => {
            // Throttle to TARGET_FPS
            if (timestamp - lastTickRef.current >= FRAME_INTERVAL) {
                lastTickRef.current = timestamp;

                const raw = getEnergyBands(analyser);
                // Normalise 0–255 → 0–1
                setBands({
                    bass: raw.bass / 255,
                    mid: raw.mid / 255,
                    treble: raw.treble / 255,
                });
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);

        return () => {
            cancelAnimationFrame(rafRef.current);
            source.disconnect();  // detach from graph before closing context
            ctx.close();
            analyserRef.current = null;
        };
    }, [stream]);

    return { bands, analyserNode: analyserRef.current };
}

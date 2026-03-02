'use client';
/**
 * hooks/useBPM.ts
 * Estimates BPM from a running buffer of bass-band energy samples.
 *
 * Uses onset detection (energy spikes above a dynamic threshold) and an
 * exponential moving average to smooth the final BPM estimate.
 *
 * Returns stable BPM in the range [50, 200].
 */

import { useEffect, useRef, useState } from 'react';

const HISTORY_SIZE = 128;   // energy samples to keep (~2s at 60fps)
const THRESHOLD_RATIO = 1.5; // spike must be 1.5× the local average
const EMA_ALPHA = 0.15;      // smoothing factor for the final BPM output

interface BPMState {
    /** Estimated BPM (50–200); starts at 120 before enough data is collected. */
    bpm: number;
    /** Beat confidence 0–1 based on how regular the detected onsets are. */
    confidence: number;
}

export function useBPM(analyserNode: AnalyserNode | null): BPMState {
    const [state, setState] = useState<BPMState>({ bpm: 120, confidence: 0 });

    // Rolling history buffers
    const energyHistory = useRef<number[]>([]);
    const onsetTimestamps = useRef<number[]>([]);
    const smoothedBpm = useRef<number>(120);
    const rafRef = useRef<number>(0);

    useEffect(() => {
        if (!analyserNode) return;

        const data = new Uint8Array(analyserNode.frequencyBinCount);

        const tick = () => {
            analyserNode.getByteFrequencyData(data);

            // Bass energy: first 12 bins ≈ 20–250 Hz
            let bassSum = 0;
            for (let i = 0; i < 12; i++) bassSum += data[i];
            const bassEnergy = bassSum / 12;

            // Maintain rolling history
            const history = energyHistory.current;
            history.push(bassEnergy);
            if (history.length > HISTORY_SIZE) history.shift();

            // Compute local average
            const avg = history.reduce((a, b) => a + b, 0) / history.length;

            // Detect onset: current energy significantly above local average
            const prevEnergy = history[history.length - 2] ?? 0;
            const isOnset =
                history.length > 2 &&
                bassEnergy > avg * THRESHOLD_RATIO &&
                bassEnergy > prevEnergy; // must be rising

            if (isOnset) {
                const now = performance.now();
                const onsets = onsetTimestamps.current;
                onsets.push(now);

                // Keep only onsets within the last 5 seconds
                while (onsets.length > 0 && now - onsets[0] > 5000) onsets.shift();

                if (onsets.length >= 4) {
                    // Calculate average inter-onset interval
                    let ioi = 0;
                    for (let i = 1; i < onsets.length; i++) ioi += onsets[i] - onsets[i - 1];
                    ioi /= onsets.length - 1;

                    const rawBpm = Math.round(60_000 / ioi);

                    // Clamp to musical range
                    const clampedBpm = Math.min(200, Math.max(50, rawBpm));

                    // Exponential moving average for smoothness
                    smoothedBpm.current = smoothedBpm.current * (1 - EMA_ALPHA) + clampedBpm * EMA_ALPHA;

                    // Confidence: how consistent are the intervals?
                    const intervals: number[] = [];
                    for (let i = 1; i < onsets.length; i++) intervals.push(onsets[i] - onsets[i - 1]);
                    const mean = intervals.reduce((a, b) => a + b, 0) / intervals.length;
                    const variance = intervals.reduce((a, b) => a + Math.abs(b - mean), 0) / intervals.length;
                    const confidence = Math.max(0, Math.min(1, 1 - variance / mean));

                    setState({ bpm: Math.round(smoothedBpm.current), confidence });
                }
            }

            rafRef.current = requestAnimationFrame(tick);
        };

        rafRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(rafRef.current);
    }, [analyserNode]);

    return state;
}

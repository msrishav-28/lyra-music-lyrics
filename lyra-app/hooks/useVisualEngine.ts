'use client';
/**
 * hooks/useVisualEngine.ts
 * Drives the audio-reactive CSS custom properties on <html> at 30fps.
 * Consumers just read CSS variables — no props drilling needed.
 *
 * Variables updated:
 *   --bpm (60-180)     --energy (0-1)  --bass (0-1)
 *   --mid (0-1)        --treble (0-1)  --hueA (0-360)
 *   --hueB (0-360)     --hueC (0-360)  --flow (0.3-2.5)
 *   --scrim (0.18-0.55)
 */

import { useEffect, useRef } from 'react';
import type { AudioBands } from './useAudioAnalyser';

const BASE_HUE_A = 270; // deep violet (matches reference image)
const BASE_HUE_B = 310; // magenta/pink
const BASE_HUE_C = 200; // cool blue accent

function setProp(name: string, value: string) {
    document.documentElement.style.setProperty(name, value);
}

function lerp(a: number, b: number, t: number) {
    return a + (b - a) * t;
}

export function useVisualEngine(
    bands: AudioBands,
    bpm: number,
    enabled: boolean
) {
    const frameRef = useRef<number>(0);
    const lastUpdateRef = useRef<number>(0);
    const smoothRef = useRef({
        energy: 0,
        bass: 0,
        mid: 0,
        treble: 0,
        hueA: BASE_HUE_A,
        hueB: BASE_HUE_B,
        hueC: BASE_HUE_C,
        flow: 1,
        scrim: 0.28,
    });

    useEffect(() => {
        if (!enabled) return;

        const INTERVAL = 1000 / 30; // 30fps

        const tick = (ts: number) => {
            frameRef.current = requestAnimationFrame(tick);

            if (ts - lastUpdateRef.current < INTERVAL) return;
            lastUpdateRef.current = ts;

            const s = smoothRef.current;
            const ALPHA = 0.12; // EMA smoothing

            // Smooth incoming values
            s.energy = lerp(s.energy, (bands.bass + bands.mid + bands.treble) / 3, ALPHA);
            s.bass = lerp(s.bass, bands.bass, ALPHA);
            s.mid = lerp(s.mid, bands.mid, ALPHA);
            s.treble = lerp(s.treble, bands.treble, ALPHA);

            // Hue driven by treble + mid (spectral centroid proxy)
            const hueShift = s.treble * 40 + s.mid * 20;
            s.hueA = ((BASE_HUE_A + hueShift) % 360);
            s.hueB = ((BASE_HUE_B + hueShift * .6) % 360);
            s.hueC = ((BASE_HUE_C - hueShift * .3 + 360) % 360);

            // Flow speed inversely proportional to BPM (fast BPM = faster background)
            const targetFlow = Math.max(0.3, Math.min(2.5, (bpm / 120)));
            s.flow = lerp(s.flow, targetFlow, 0.05);

            // Contrast governor: increase scrim when background is bright/energetic
            const brightness = s.bass * 0.5 + s.treble * 0.3 + s.mid * 0.2;
            const targetScrim = Math.max(0.18, Math.min(0.55, 0.28 + brightness * 0.27));
            s.scrim = lerp(s.scrim, targetScrim, 0.06);

            // Push to DOM
            setProp('--energy', s.energy.toFixed(3));
            setProp('--bass', s.bass.toFixed(3));
            setProp('--mid', s.mid.toFixed(3));
            setProp('--treble', s.treble.toFixed(3));
            setProp('--hueA', s.hueA.toFixed(1));
            setProp('--hueB', s.hueB.toFixed(1));
            setProp('--hueC', s.hueC.toFixed(1));
            setProp('--flow', s.flow.toFixed(3));
            setProp('--scrim', s.scrim.toFixed(3));
            setProp('--bpm', String(Math.round(bpm)));
        };

        frameRef.current = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(frameRef.current);
    }, [bands, bpm, enabled]);
}

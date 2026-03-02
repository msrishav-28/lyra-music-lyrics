'use client';
/**
 * src/app/components/DebugOverlay.tsx
 * Dev-mode overlay showing provider states, cache hits, and audio metrics.
 * Only visible when debugMode is true.
 */
interface Props {
    provider: string;
    lyricsProvider?: string;
    bass: number;
    mid: number;
    treble: number;
    bpm: number;
    confidence: number;
    appState: string;
}

export default function DebugOverlay({
    provider, lyricsProvider, bass, mid, treble, bpm, confidence, appState,
}: Props) {
    return (
        <div
            className="fixed top-4 left-4 z-40 rounded-xl px-3 py-2.5 font-mono text-[10px] leading-relaxed pointer-events-none"
            style={{
                background: 'rgba(0,0,0,0.6)',
                border: '1px solid rgba(255,255,255,0.1)',
                backdropFilter: 'blur(12px)',
                color: 'rgba(255,255,255,0.5)',
                minWidth: 180,
            }}
            aria-hidden
        >
            <div style={{ color: 'rgba(255,255,255,0.7)', marginBottom: 4 }}>LYRA DEBUG</div>
            <div>state: <span style={{ color: '#2CFFB7' }}>{appState}</span></div>
            <div>recognition: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{provider || '—'}</span></div>
            <div>lyrics: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{lyricsProvider || '—'}</span></div>
            <div>confidence: <span style={{ color: confidence > 0.7 ? '#2CFFB7' : '#FFB020' }}>{(confidence * 100).toFixed(0)}%</span></div>
            <div className="mt-1">bpm: {Math.round(bpm)}</div>
            <div>bass: {(bass * 100).toFixed(0)}%</div>
            <div>mid: {(mid * 100).toFixed(0)}%</div>
            <div>treble: {(treble * 100).toFixed(0)}%</div>
        </div>
    );
}

'use client';
/**
 * src/app/components/SongCard.tsx
 * Acrylic card showing matched song metadata — matches the reference image:
 * album art (left) + title/artist/progress (right), at the bottom of the screen.
 */
import { motion } from 'framer-motion';
import type { SongIdentity } from '@/lib/types';

interface Props {
    song: SongIdentity;
    elapsedSeconds: number;
    provider?: string;
    debugMode: boolean;
}

function formatTime(sec: number) {
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function SongCard({ song, elapsedSeconds, provider, debugMode }: Props) {
    const progress = song.durationMs
        ? Math.min(1, elapsedSeconds / (song.durationMs / 1000))
        : 0;

    return (
        <motion.div
            initial={{ y: 80, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 80, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 280, damping: 28 }}
            className="acrylic rounded-2xl px-4 py-3 flex items-center gap-4 w-full max-w-sm mx-auto"
            role="region"
            aria-label={`Now playing: ${song.title} by ${song.artist}`}
        >
            {/* Album art placeholder */}
            <div
                className="flex-shrink-0 rounded-xl overflow-hidden"
                style={{ width: 52, height: 52 }}
            >
                <div
                    className="w-full h-full flex items-center justify-center"
                    style={{
                        background: `linear-gradient(135deg, hsl(var(--hueA), 70%, 35%), hsl(var(--hueB), 80%, 25%))`,
                    }}
                >
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.7)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <circle cx="12" cy="12" r="10" />
                        <circle cx="12" cy="12" r="3" />
                    </svg>
                </div>
            </div>

            {/* Song info */}
            <div className="flex-1 min-w-0">
                <p
                    className="font-semibold truncate leading-tight"
                    style={{ fontSize: 15, color: 'rgba(255,255,255,0.92)' }}
                >
                    {song.title}
                </p>
                <p
                    className="truncate"
                    style={{ fontSize: 12, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}
                >
                    {song.artist}
                </p>

                {/* Progress bar */}
                <div
                    className="mt-2 rounded-full overflow-hidden"
                    style={{ height: 3, background: 'rgba(255,255,255,0.14)' }}
                >
                    <motion.div
                        className="h-full rounded-full"
                        style={{
                            background: `linear-gradient(90deg, hsl(var(--hueA), 80%, 60%), hsl(var(--hueB), 80%, 60%))`,
                        }}
                        animate={{ width: `${progress * 100}%` }}
                        transition={{ duration: 1, ease: 'linear' }}
                    />
                </div>

                {song.durationMs && (
                    <div className="flex justify-between mt-1" style={{ fontSize: 10, color: 'rgba(255,255,255,0.35)' }}>
                        <span>{formatTime(elapsedSeconds)}</span>
                        <span>{formatTime(song.durationMs / 1000)}</span>
                    </div>
                )}
            </div>

            {/* Waveform activity indicator */}
            <div className="flex items-center gap-[2px] flex-shrink-0" aria-hidden>
                {[1, 0.6, 0.85, 0.5, 0.9].map((h, i) => (
                    <motion.div
                        key={i}
                        className="rounded-full"
                        style={{
                            width: 2.5,
                            background: `hsl(var(--hueA), 70%, 65%)`,
                        }}
                        animate={{ height: [5 * h, 14 * h, 5 * h] }}
                        transition={{ duration: 0.5 + i * 0.12, repeat: Infinity, ease: 'easeInOut', delay: i * 0.1 }}
                    />
                ))}
            </div>

            {/* Debug provider badge */}
            {debugMode && provider && (
                <div
                    className="absolute top-2 right-3 text-[9px] font-mono px-1.5 py-0.5 rounded"
                    style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.4)' }}
                >
                    {provider}
                </div>
            )}
        </motion.div>
    );
}

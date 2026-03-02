'use client';
/**
 * src/app/components/LyricsViewport.tsx
 * Rolling lyric view — renders ±4 lines around the active line.
 * Active line: large, bright. Neighbors: smaller, faded.
 * Beat-kick micro-pulse on active line driven by bass.
 */
import { motion, AnimatePresence } from 'framer-motion';
import type { LyricLine } from '@/lib/types';

interface Props {
    lines: LyricLine[];
    translatedLines?: string[];
    activeIndex: number;
    bass: number;
    energy: number;
    reduceMotion: boolean;
    translateEnabled: boolean;
}

const WINDOW = 4; // lines above and below to render

function lineOpacity(offset: number): number {
    if (offset === 0) return 0.92;
    if (Math.abs(offset) === 1) return 0.5;
    if (Math.abs(offset) === 2) return 0.28;
    return 0.12;
}

function lineScale(offset: number): number {
    if (offset === 0) return 1.04;
    if (Math.abs(offset) === 1) return 0.96;
    return 0.91;
}

function lineFontSize(offset: number): string {
    if (offset === 0) return 'clamp(22px, 4.5vw, 40px)';
    if (Math.abs(offset) === 1) return 'clamp(16px, 3vw, 26px)';
    return 'clamp(13px, 2.4vw, 20px)';
}

export default function LyricsViewport({
    lines,
    translatedLines,
    activeIndex,
    bass,
    energy,
    reduceMotion,
    translateEnabled,
}: Props) {
    const visible: { line: LyricLine; offset: number; translated?: string }[] = [];

    for (let i = activeIndex - WINDOW; i <= activeIndex + WINDOW; i++) {
        if (i >= 0 && i < lines.length) {
            visible.push({
                line: lines[i],
                offset: i - activeIndex,
                translated: translatedLines?.[i],
            });
        }
    }

    // Beat kick scale boost on active line
    const kickScale = reduceMotion ? 1 : 1.04 + bass * 0.045;

    return (
        <div className="relative flex flex-col items-center justify-center px-6 py-8 w-full max-w-2xl mx-auto">
            {/* Scrim behind text — contrast governor */}
            <div
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{
                    background: `rgba(0,0,0,var(--scrim, 0.28))`,
                    backdropFilter: 'blur(10px)',
                    WebkitBackdropFilter: 'blur(10px)',
                }}
            />

            <AnimatePresence mode="popLayout" initial={false}>
                {visible.map(({ line, offset, translated }) => {
                    const isActive = offset === 0;
                    const scale = isActive ? kickScale : lineScale(offset);

                    return (
                        <motion.div
                            key={`${activeIndex}-${offset}-${line.time}`}
                            layout={!reduceMotion}
                            initial={{ opacity: 0, y: reduceMotion ? 0 : 18 }}
                            animate={{
                                opacity: lineOpacity(offset),
                                scale,
                                y: 0,
                                filter: isActive ? 'blur(0px)' : 'blur(0px)',
                            }}
                            exit={{ opacity: 0, y: reduceMotion ? 0 : -12 }}
                            transition={{
                                duration: 0.28,
                                ease: [0.25, 0.46, 0.45, 0.94],
                            }}
                            className="relative z-10 text-center select-none leading-tight py-[6px]"
                            style={{
                                fontSize: lineFontSize(offset),
                                fontWeight: isActive ? 700 : 500,
                                color: 'rgba(255,255,255,0.92)',
                                letterSpacing: isActive ? '-0.01em' : '-0.005em',
                                textShadow: isActive
                                    ? `0 0 ${22 + energy * 18}px hsla(var(--hueA), 80%, 70%, ${0.3 + energy * 0.35})`
                                    : 'none',
                                willChange: isActive ? 'transform, opacity' : undefined,
                            }}
                            aria-current={isActive ? 'true' : undefined}
                        >
                            {line.text}

                            {/* Translation line below active */}
                            {isActive && translateEnabled && translated && (
                                <motion.div
                                    initial={{ opacity: 0 }}
                                    animate={{ opacity: 0.6 }}
                                    className="mt-1 text-center"
                                    style={{
                                        fontSize: 'clamp(13px, 2.4vw, 18px)',
                                        fontWeight: 400,
                                        fontStyle: 'italic',
                                        color: 'rgba(255,255,255,0.62)',
                                        letterSpacing: '0.01em',
                                    }}
                                >
                                    {translated}
                                </motion.div>
                            )}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}

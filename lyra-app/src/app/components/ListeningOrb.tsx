'use client';
/**
 * src/app/components/ListeningOrb.tsx
 * The central orb shown on the idle/listening screen.
 * Pulses with RMS energy, breathes when idle.
 */
import { motion } from 'framer-motion';

interface Props {
    energy: number;   // 0-1
    bass: number;     // 0-1
    active: boolean;  // true when mic is on
    onClick: () => void;
}

export default function ListeningOrb({ energy, bass, active, onClick }: Props) {
    const scale = active ? 1 + energy * 0.18 + bass * 0.08 : 1;
    const glowSize = active ? 60 + bass * 80 : 40;
    const glowOpacity = active ? 0.3 + energy * 0.4 : 0.15;

    return (
        <motion.button
            onClick={onClick}
            aria-label={active ? 'Stop listening' : 'Start listening'}
            className="relative flex items-center justify-center rounded-full cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30"
            style={{ width: 120, height: 120 }}
            animate={{ scale }}
            transition={{ type: 'spring', stiffness: 200, damping: 20 }}
            whileTap={{ scale: 0.94 }}
        >
            {/* Outer glow ring */}
            <motion.div
                className="absolute rounded-full pointer-events-none"
                style={{
                    inset: -glowSize / 2,
                    background: `radial-gradient(circle, hsla(var(--hueA), 80%, 60%, ${glowOpacity}) 0%, transparent 70%)`,
                }}
                animate={{ opacity: glowOpacity }}
                transition={{ duration: 0.15 }}
            />

            {/* Breathing idle ring */}
            {!active && (
                <motion.div
                    className="absolute inset-0 rounded-full border border-white/20"
                    animate={{ scale: [1, 1.12, 1], opacity: [0.4, 0.15, 0.4] }}
                    transition={{ duration: 2.4, repeat: Infinity, ease: 'easeInOut' }}
                />
            )}

            {/* Core orb */}
            <div
                className="absolute inset-0 rounded-full acrylic"
                style={{
                    background: active
                        ? `radial-gradient(circle at 35% 35%, hsl(var(--hueA), 80%, 55%), hsl(var(--hueB), 75%, 35%))`
                        : `radial-gradient(circle at 35% 35%, rgba(255,255,255,0.25), rgba(255,255,255,0.06))`,
                    boxShadow: active
                        ? `0 0 ${glowSize}px hsla(var(--hueA), 80%, 50%, 0.5), inset 0 1px 0 rgba(255,255,255,0.3)`
                        : `0 0 40px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.2)`,
                    transition: 'background 0.4s ease, box-shadow 0.2s ease',
                }}
            />

            {/* Icon */}
            <div className="relative z-10 flex items-center justify-center">
                {active ? (
                    /* Waveform bars when listening */
                    <div className="flex items-center gap-[3px]" aria-hidden>
                        {[0.6, 1, 0.75, 1, 0.55].map((h, i) => (
                            <motion.div
                                key={i}
                                className="rounded-full bg-white/90"
                                style={{ width: 3 }}
                                animate={{ height: [8 * h, 22 * h * (1 + energy * 0.5), 8 * h] }}
                                transition={{ duration: 0.4 + i * 0.1, repeat: Infinity, ease: 'easeInOut', delay: i * 0.08 }}
                            />
                        ))}
                    </div>
                ) : (
                    /* Mic icon when idle */
                    <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.8)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                        <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                        <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                        <line x1="12" y1="19" x2="12" y2="22" />
                        <line x1="8" y1="22" x2="16" y2="22" />
                    </svg>
                )}
            </div>
        </motion.button>
    );
}

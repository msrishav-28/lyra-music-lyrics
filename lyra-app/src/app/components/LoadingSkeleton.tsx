'use client';
/**
 * src/app/components/LoadingSkeleton.tsx
 * 7-line shimmer skeleton for the lyrics loading state.
 * Shimmer speed tied to --bpm CSS variable (subtle).
 */
import { motion } from 'framer-motion';

const LINE_WIDTHS = ['72%', '58%', '80%', '52%', '76%', '60%', '68%'];

export default function LoadingSkeleton() {
    return (
        <div className="flex flex-col items-center gap-3 w-full max-w-sm px-8" role="status" aria-label="Loading lyrics">
            {LINE_WIDTHS.map((w, i) => (
                <motion.div
                    key={i}
                    className="rounded-full"
                    style={{
                        width: w,
                        height: i === 3 ? 18 : 12, // middle line slightly larger (active slot)
                        background: 'rgba(255,255,255,0.08)',
                        backdropFilter: 'blur(6px)',
                    }}
                    animate={{ opacity: [0.4, 0.9, 0.4] }}
                    transition={{
                        duration: 1.4,
                        repeat: Infinity,
                        ease: 'easeInOut',
                        delay: i * 0.12,
                    }}
                />
            ))}
        </div>
    );
}

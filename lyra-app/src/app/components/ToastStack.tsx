'use client';
/**
 * src/app/components/ToastStack.tsx
 * Non-blocking toast notifications for soft errors + provider switches.
 * Stacks up to 3 toasts, each auto-dismisses after 4s.
 */
import { useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

export interface Toast {
    id: string;
    message: string;
    type: 'info' | 'warning' | 'error';
}

interface Props {
    toasts: Toast[];
    onDismiss: (id: string) => void;
}

function toastColor(type: Toast['type']) {
    if (type === 'error') return 'rgba(255, 77, 109, 0.20)';
    if (type === 'warning') return 'rgba(255, 176, 32, 0.18)';
    return 'rgba(255,255,255,0.08)';
}
function toastBorder(type: Toast['type']) {
    if (type === 'error') return 'rgba(255, 77, 109, 0.35)';
    if (type === 'warning') return 'rgba(255, 176, 32, 0.30)';
    return 'rgba(255,255,255,0.12)';
}

export default function ToastStack({ toasts, onDismiss }: Props) {
    const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

    useEffect(() => {
        toasts.forEach(t => {
            if (!timers.current[t.id]) {
                timers.current[t.id] = setTimeout(() => {
                    onDismiss(t.id);
                    delete timers.current[t.id];
                }, 4000);
            }
        });
    }, [toasts, onDismiss]);

    return (
        <div
            className="fixed top-4 right-4 z-50 flex flex-col gap-2 pointer-events-none"
            aria-live="polite"
            aria-relevant="additions"
        >
            <AnimatePresence>
                {toasts.slice(-3).map(t => (
                    <motion.div
                        key={t.id}
                        initial={{ opacity: 0, x: 30, scale: 0.95 }}
                        animate={{ opacity: 1, x: 0, scale: 1 }}
                        exit={{ opacity: 0, x: 20, scale: 0.92 }}
                        transition={{ duration: 0.22, ease: 'easeOut' }}
                        className="pointer-events-auto rounded-xl px-4 py-2.5 text-sm"
                        style={{
                            background: toastColor(t.type),
                            border: `1px solid ${toastBorder(t.type)}`,
                            backdropFilter: 'blur(20px)',
                            WebkitBackdropFilter: 'blur(20px)',
                            color: 'rgba(255,255,255,0.85)',
                            maxWidth: 300,
                            fontSize: 13,
                        }}
                        role="alert"
                    >
                        {t.message}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}

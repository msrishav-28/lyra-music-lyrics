'use client';
/**
 * src/app/components/DynamicPill.tsx
 * Bottom control pill — auto-hides after 3s idle, revealed on tap/move.
 * Contains: mic toggle, translation toggle + language selector, debug toggle.
 */
import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

const LANGUAGES = [
    { code: 'FR', label: 'French' },
    { code: 'ES', label: 'Spanish' },
    { code: 'DE', label: 'German' },
    { code: 'JA', label: 'Japanese' },
    { code: 'KO', label: 'Korean' },
    { code: 'PT', label: 'Portuguese' },
    { code: 'IT', label: 'Italian' },
    { code: 'ZH', label: 'Chinese' },
    { code: 'HI', label: 'Hindi' },
    { code: 'AR', label: 'Arabic' },
];

interface Props {
    micEnabled: boolean;
    translateEnabled: boolean;
    targetLang: string;
    debugMode: boolean;
    onMicToggle: () => void;
    onTranslateToggle: () => void;
    onLangChange: (lang: string) => void;
    onDebugToggle: () => void;
}

export default function DynamicPill({
    micEnabled,
    translateEnabled,
    targetLang,
    debugMode,
    onMicToggle,
    onTranslateToggle,
    onLangChange,
    onDebugToggle,
}: Props) {
    const [visible, setVisible] = useState(true);
    const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    function resetTimer() {
        setVisible(true);
        if (hideTimer.current) clearTimeout(hideTimer.current);
        hideTimer.current = setTimeout(() => setVisible(false), 3000);
    }

    useEffect(() => {
        resetTimer();
        window.addEventListener('pointermove', resetTimer);
        window.addEventListener('pointerdown', resetTimer);
        window.addEventListener('keydown', resetTimer);
        return () => {
            window.removeEventListener('pointermove', resetTimer);
            window.removeEventListener('pointerdown', resetTimer);
            window.removeEventListener('keydown', resetTimer);
            if (hideTimer.current) clearTimeout(hideTimer.current);
        };
    }, []);

    const selectedLang = LANGUAGES.find(l => l.code === targetLang);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ y: 20, opacity: 0 }}
                    animate={{ y: 0, opacity: 1 }}
                    exit={{ y: 20, opacity: 0 }}
                    transition={{ duration: 0.22, ease: 'easeOut' }}
                    className="acrylic rounded-full px-3 py-2 flex items-center gap-2"
                    role="toolbar"
                    aria-label="Controls"
                >
                    {/* Mic button */}
                    <button
                        onClick={onMicToggle}
                        aria-label={micEnabled ? 'Stop listening' : 'Start listening'}
                        aria-pressed={micEnabled}
                        className="rounded-full p-2.5 transition-colors"
                        style={{
                            background: micEnabled
                                ? `hsl(var(--hueA), 75%, 45%)`
                                : 'rgba(255,255,255,0.1)',
                            boxShadow: micEnabled
                                ? `0 0 16px hsla(var(--hueA), 80%, 50%, 0.4)`
                                : 'none',
                        }}
                    >
                        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            {micEnabled ? (
                                <>
                                    <rect x="9" y="9" width="6" height="6" rx="1" />
                                </>
                            ) : (
                                <>
                                    <path d="M12 2a3 3 0 0 1 3 3v7a3 3 0 0 1-6 0V5a3 3 0 0 1 3-3Z" />
                                    <path d="M19 10v2a7 7 0 0 1-14 0v-2" />
                                    <line x1="12" y1="19" x2="12" y2="22" />
                                </>
                            )}
                        </svg>
                    </button>

                    <div className="w-px h-5 bg-white/10" />

                    {/* Translate toggle */}
                    <button
                        onClick={onTranslateToggle}
                        aria-label={translateEnabled ? 'Disable translation' : 'Enable translation'}
                        aria-pressed={translateEnabled}
                        className="rounded-full px-3 py-1.5 text-xs font-medium transition-colors"
                        style={{
                            background: translateEnabled ? 'rgba(255,255,255,0.15)' : 'transparent',
                            color: translateEnabled ? 'rgba(255,255,255,0.9)' : 'rgba(255,255,255,0.45)',
                        }}
                    >
                        Translate
                    </button>

                    {/* Language selector */}
                    {translateEnabled && (
                        <select
                            value={targetLang}
                            onChange={e => onLangChange(e.target.value)}
                            aria-label="Translation language"
                            className="rounded-full px-2 py-1 text-xs font-medium bg-transparent border-none outline-none cursor-pointer"
                            style={{ color: 'rgba(255,255,255,0.7)' }}
                        >
                            {LANGUAGES.map(l => (
                                <option key={l.code} value={l.code} style={{ background: '#0B0B12', color: '#fff' }}>
                                    {l.label}
                                </option>
                            ))}
                        </select>
                    )}

                    <div className="w-px h-5 bg-white/10" />

                    {/* Debug toggle */}
                    <button
                        onClick={onDebugToggle}
                        aria-label="Toggle debug mode"
                        aria-pressed={debugMode}
                        className="rounded-full p-2 transition-opacity"
                        style={{ opacity: debugMode ? 0.9 : 0.4 }}
                    >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                            <circle cx="12" cy="12" r="3" />
                            <path d="M12 1v3M12 20v3M4.22 4.22l2.12 2.12M17.66 17.66l2.12 2.12M1 12h3M20 12h3M4.22 19.78l2.12-2.12M17.66 6.34l2.12-2.12" />
                        </svg>
                    </button>
                </motion.div>
            )}
        </AnimatePresence>
    );
}

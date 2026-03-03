'use client';
/**
 * src/app/page.tsx
 * Lyra — main page. Orchestrates the full state machine:
 * idle -> listening -> matched -> lyrics_loading -> synced/unsynced -> [translate]
 * All API keys remain server-side; this file only calls our own /api/* routes.
 */

import { useCallback, useEffect, useReducer, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';

import AnimatedBackground from './components/AnimatedBackground';
import ListeningOrb from './components/ListeningOrb';
import LyricsViewport from './components/LyricsViewport';
import SongCard from './components/SongCard';
import DynamicPill from './components/DynamicPill';
import LoadingSkeleton from './components/LoadingSkeleton';
import ToastStack from './components/ToastStack';
import DebugOverlay from './components/DebugOverlay';

import { useAudioAnalyser } from '@/hooks/useAudioAnalyser';
import { useBPM } from '@/hooks/useBPM';
import { useLyricsSync } from '@/hooks/useLyricsSync';
import { useVisualEngine } from '@/hooks/useVisualEngine';
import { useAudioCapture } from '@/hooks/useAudioCapture';

import type { SongIdentity, LyricsPayload, TranslationPayload, LyricLine } from '@/lib/types';
import type { AppState } from '@/lib/appState';
import type { Toast } from './components/ToastStack';

// ---------------------------------------------------------------------------
// Toast helpers
// ---------------------------------------------------------------------------
let _toastId = 0;
function makeToast(message: string, type: Toast['type'] = 'info'): Toast {
  return { id: String(++_toastId), message, type };
}

// ---------------------------------------------------------------------------
// State
// ---------------------------------------------------------------------------
interface State {
  appState: AppState;
  song: SongIdentity | null;
  lyrics: LyricsPayload | null;
  translation: TranslationPayload | null;
  micEnabled: boolean;
  translateEnabled: boolean;
  targetLang: string;
  debugMode: boolean;
  toasts: Toast[];
  lyricsProvider: string;
}

type Action =
  | { type: 'MIC_TOGGLE' }
  | { type: 'TRANSLATE_TOGGLE' }
  | { type: 'LANG_CHANGE'; lang: string }
  | { type: 'DEBUG_TOGGLE' }
  | { type: 'MATCHED'; song: SongIdentity }
  | { type: 'LYRICS_OK'; payload: LyricsPayload }
  | { type: 'LYRICS_FAIL' }
  | { type: 'TRANSLATION_OK'; payload: TranslationPayload }
  | { type: 'TOAST'; toast: Toast }
  | { type: 'DISMISS_TOAST'; id: string }
  | { type: 'SET_STATE'; state: AppState };

function reducer(s: State, a: Action): State {
  switch (a.type) {
    case 'MIC_TOGGLE':
      return { ...s, micEnabled: !s.micEnabled, appState: s.micEnabled ? 'idle' : 'listening' };
    case 'TRANSLATE_TOGGLE':
      return { ...s, translateEnabled: !s.translateEnabled };
    case 'LANG_CHANGE':
      return { ...s, targetLang: a.lang, translation: null };
    case 'DEBUG_TOGGLE':
      return { ...s, debugMode: !s.debugMode };
    case 'MATCHED':
      return { ...s, song: a.song, appState: 'matched', lyrics: null, translation: null };
    case 'LYRICS_OK':
      return {
        ...s,
        lyrics: a.payload,
        appState: a.payload.quality === 'synced' ? 'synced' : 'unsynced',
        lyricsProvider: a.payload.provider,
      };
    case 'LYRICS_FAIL':
      return { ...s, appState: 'error_soft' };
    case 'TRANSLATION_OK':
      return { ...s, translation: a.payload, appState: s.appState === 'translating' ? (s.lyrics?.quality === 'synced' ? 'synced' : 'unsynced') : s.appState };
    case 'SET_STATE':
      return { ...s, appState: a.state };
    case 'TOAST':
      return { ...s, toasts: [...s.toasts, a.toast].slice(-5) };
    case 'DISMISS_TOAST':
      return { ...s, toasts: s.toasts.filter(t => t.id !== a.id) };
    default:
      return s;
  }
}

const INITIAL: State = {
  appState: 'idle',
  song: null,
  lyrics: null,
  translation: null,
  micEnabled: false,
  translateEnabled: false,
  targetLang: 'FR',
  debugMode: false,
  toasts: [],
  lyricsProvider: '',
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------
export default function LyraPage() {
  const [st, dispatch] = useReducer(reducer, INITIAL);

  // ---------- Audio pipeline ----------
  const onMatch = useCallback((song: SongIdentity) => {
    dispatch({ type: 'MATCHED', song });
  }, []);

  const onError = useCallback((msg: string, _hard = false) => {
    dispatch({ type: 'TOAST', toast: makeToast(msg, 'warning') });
  }, []);

  const { stream } = useAudioCapture({
    enabled: st.micEnabled,
    onMatch,
    onError,
  });

  const { bands, analyserNode } = useAudioAnalyser(stream);
  const { bpm } = useBPM(analyserNode);
  useVisualEngine(bands, bpm, st.micEnabled);

  // ---------- Lyrics sync ----------
  const lines: LyricLine[] = st.lyrics?.syncedLines ?? [];
  const { activeIndex, elapsedSeconds } = useLyricsSync(
    lines,
    st.song?.playOffsetMs ?? 0,
    st.appState === 'synced'
  );

  // ---------- Fetch lyrics on match ----------
  const lastSongId = useRef<string>('');
  useEffect(() => {
    if (!st.song || st.song.id === lastSongId.current) return;
    lastSongId.current = st.song.id;

    dispatch({ type: 'SET_STATE', state: 'lyrics_loading' });

    fetch(`/api/lyrics?title=${encodeURIComponent(st.song.title)}&artist=${encodeURIComponent(st.song.artist)}`)
      .then(r => r.json())
      .then((payload: LyricsPayload & { error?: string }) => {
        if (payload.error) { dispatch({ type: 'LYRICS_FAIL' }); return; }
        dispatch({ type: 'LYRICS_OK', payload });
      })
      .catch(() => dispatch({ type: 'LYRICS_FAIL' }));
  }, [st.song]);

  // ---------- Fetch translation ----------
  const lastTranslateKey = useRef('');
  useEffect(() => {
    if (!st.translateEnabled || !st.lyrics || !st.song) return;
    const linesToTranslate = st.lyrics.syncedLines?.map(l => l.text) ?? st.lyrics.plainText?.split('\n') ?? [];
    const key = `${st.song.id}:${st.targetLang}`;
    if (key === lastTranslateKey.current || linesToTranslate.length === 0) return;
    lastTranslateKey.current = key;

    dispatch({ type: 'SET_STATE', state: 'translating' });

    fetch('/api/translate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ lines: linesToTranslate, targetLang: st.targetLang }),
    })
      .then(r => r.json())
      .then((payload: TranslationPayload & { error?: string }) => {
        if (payload.error) {
          dispatch({ type: 'TOAST', toast: makeToast('Translation unavailable — showing original', 'info') });
          dispatch({ type: 'SET_STATE', state: st.lyrics?.quality === 'synced' ? 'synced' : 'unsynced' });
          return;
        }
        dispatch({ type: 'TRANSLATION_OK', payload });
      })
      .catch(() => {
        dispatch({ type: 'SET_STATE', state: st.lyrics?.quality === 'synced' ? 'synced' : 'unsynced' });
      });
  }, [st.translateEnabled, st.targetLang, st.lyrics, st.song]);

  // ---------- Reduce motion (OS setting) ----------
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    const mq = matchMedia('(prefers-reduced-motion: reduce)');
    setReduceMotion(mq.matches);
    mq.addEventListener('change', e => setReduceMotion(e.matches));
  }, []);

  const showLyrics = st.appState === 'synced' || st.appState === 'unsynced' || st.appState === 'translating';

  return (
    <main
      className="relative min-h-dvh flex flex-col items-center overflow-hidden"
      style={{ background: 'var(--background)' }}
      onClick={(e) => {
        // Tap anywhere to reveal controls
        const target = e.target as HTMLElement;
        if (target.closest('button') || target.closest('select')) return;
      }}
    >
      {/* Full-bleed animated background */}
      <AnimatedBackground />

      {/* Toast stack */}
      <ToastStack
        toasts={st.toasts}
        onDismiss={id => dispatch({ type: 'DISMISS_TOAST', id })}
      />

      {/* Debug overlay */}
      {st.debugMode && (
        <DebugOverlay
          provider={st.song?.provider ?? ''}
          lyricsProvider={st.lyricsProvider}
          bass={bands.bass}
          mid={bands.mid}
          treble={bands.treble}
          bpm={bpm}
          confidence={st.song?.confidence ?? 0}
          appState={st.appState}
        />
      )}

      {/* App header */}
      <header className="w-full flex items-center justify-between px-5 py-4 z-10">
        <span
          style={{
            fontSize: 18,
            fontWeight: 700,
            letterSpacing: '-0.03em',
            color: 'rgba(255,255,255,0.90)',
          }}
        >
          Lyra
        </span>

        {/* Language badge when a song is matched */}
        {st.lyrics?.language && (
          <span
            className="rounded-full px-2.5 py-1 text-xs font-medium"
            style={{
              background: 'rgba(255,255,255,0.08)',
              border: '1px solid rgba(255,255,255,0.12)',
              color: 'rgba(255,255,255,0.55)',
            }}
          >
            {st.lyrics.language.toUpperCase()}
          </span>
        )}
      </header>

      {/* ---------- Main content area ---------- */}
      <div className="flex-1 flex flex-col items-center justify-center w-full z-10 px-4 gap-6">
        <AnimatePresence mode="wait">
          {/* IDLE / LISTENING: show orb + status text */}
          {(st.appState === 'idle' || st.appState === 'listening') && (
            <motion.div
              key="orb-view"
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ duration: 0.3 }}
              className="flex flex-col items-center gap-8"
            >
              <ListeningOrb
                energy={bands.bass * 0.5 + (bands.mid + bands.treble) / 4}
                bass={bands.bass}
                active={st.micEnabled}
                onClick={() => dispatch({ type: 'MIC_TOGGLE' })}
              />
              <motion.p
                key={st.appState}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                style={{
                  fontSize: 15,
                  color: 'rgba(255,255,255,0.45)',
                  letterSpacing: '0.02em',
                }}
              >
                {st.appState === 'idle' ? 'Tap to start listening' : 'Listening\u2026'}
              </motion.p>

              {/* Hint when idle */}
              {st.appState === 'idle' && (
                <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.25)', textAlign: 'center', maxWidth: 220 }}>
                  Hum, sing, or play any song
                </p>
              )}
            </motion.div>
          )}

          {/* LYRICS LOADING: skeleton */}
          {st.appState === 'lyrics_loading' && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-4"
            >
              <p style={{ fontSize: 13, color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
                {st.song?.title} — {st.song?.artist}
              </p>
              <LoadingSkeleton />
            </motion.div>
          )}

          {/* SYNCED / UNSYNCED / TRANSLATING: rolling lyrics */}
          {showLyrics && st.lyrics && (
            <motion.div
              key="lyrics-view"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.35 }}
              className="w-full max-w-2xl"
            >
              <LyricsViewport
                lines={lines.length > 0 ? lines : (st.lyrics.plainText?.split('\n').filter(Boolean).map((text, i) => ({ time: i * 5, text })) ?? [])}
                translatedLines={st.translation?.lines}
                activeIndex={activeIndex}
                bass={bands.bass}
                energy={(bands.bass + bands.mid + bands.treble) / 3}
                reduceMotion={reduceMotion}
                translateEnabled={st.translateEnabled && !!st.translation}
              />
            </motion.div>
          )}

          {/* ERROR SOFT: keep running quietly with a hint */}
          {st.appState === 'error_soft' && (
            <motion.div
              key="error-soft"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col items-center gap-4 text-center px-8"
            >
              <ListeningOrb
                energy={bands.bass}
                bass={bands.bass}
                active={st.micEnabled}
                onClick={() => dispatch({ type: 'MIC_TOGGLE' })}
              />
              <div style={{ color: 'rgba(255,255,255,0.45)', fontSize: 14 }}>
                <p>No lyrics found</p>
                <p style={{ fontSize: 12, marginTop: 8, color: 'rgba(255,255,255,0.28)' }}>Try humming the chorus</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Bottom area: song card + control pill */}
      <div className="w-full z-10 flex flex-col items-center gap-3 px-5 pb-6 pt-2">
        <AnimatePresence>
          {st.song && (st.appState === 'matched' || showLyrics) && (
            <SongCard
              song={st.song}
              elapsedSeconds={elapsedSeconds}
              provider={st.song.provider}
              debugMode={st.debugMode}
            />
          )}
        </AnimatePresence>

        <DynamicPill
          micEnabled={st.micEnabled}
          translateEnabled={st.translateEnabled}
          targetLang={st.targetLang}
          debugMode={st.debugMode}
          onMicToggle={() => dispatch({ type: 'MIC_TOGGLE' })}
          onTranslateToggle={() => dispatch({ type: 'TRANSLATE_TOGGLE' })}
          onLangChange={lang => dispatch({ type: 'LANG_CHANGE', lang })}
          onDebugToggle={() => dispatch({ type: 'DEBUG_TOGGLE' })}
        />
      </div>
    </main>
  );
}

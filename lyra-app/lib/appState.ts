/**
 * lib/appState.ts
 * Single source of truth for the Lyra UI state machine.
 * Every component reads from and writes to this shared type.
 */

import type { SongIdentity, LyricsPayload, TranslationPayload } from './types';

export type AppState =
    | 'idle'           // Waiting — orb breathing
    | 'listening'      // Mic active, sending audio to API
    | 'candidate'      // ≥1 low-confidence match found, still listening
    | 'matched'        // High-confidence match; loading lyrics
    | 'lyrics_loading' // Lyrics API call in flight
    | 'synced'         // Rolling LRC lyrics running
    | 'unsynced'       // Plain-text paragraph mode
    | 'translating'    // Translation in flight (lyrics still visible)
    | 'error_soft'     // Non-blocking failure; keep UI running
    | 'error_hard';    // Unrecoverable; show recovery dialog

// The full application store passed via context
export interface LyraStore {
    state: AppState;
    song: SongIdentity | null;
    lyrics: LyricsPayload | null;
    translation: TranslationPayload | null;
    targetLang: string;
    micStream: MediaStream | null;
    micEnabled: boolean;
    translateEnabled: boolean;
    reduceMotion: boolean;
    highContrast: boolean;
    debugMode: boolean;
    lastError: string | null;
}

export const initialStore: LyraStore = {
    state: 'idle',
    song: null,
    lyrics: null,
    translation: null,
    targetLang: 'FR',
    micStream: null,
    micEnabled: false,
    translateEnabled: false,
    reduceMotion: false,
    highContrast: false,
    debugMode: false,
    lastError: null,
};

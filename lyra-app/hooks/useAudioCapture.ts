'use client';
/**
 * hooks/useAudioCapture.ts
 * Manages the mic MediaStream, MediaRecorder chunking, and recognition polling.
 * Every N seconds sends a 5-10s audio chunk to /api/recognize.
 */

import { useCallback, useEffect, useRef, useState } from 'react';
import type { SongIdentity } from '@/lib/types';

const CHUNK_INTERVAL_MS = 8000;  // Send audio every 8s
const CHUNK_DURATION_MS = 8000;  // Record 8s chunks

interface UseAudioCaptureOptions {
    enabled: boolean;
    onMatch: (song: SongIdentity) => void;
    onError: (msg: string, hard?: boolean) => void;
}

export function useAudioCapture({
    enabled,
    onMatch,
    onError,
}: UseAudioCaptureOptions) {
    const [stream, setStream] = useState<MediaStream | null>(null);
    const recorderRef = useRef<MediaRecorder | null>(null);
    const chunksRef = useRef<Blob[]>([]);
    const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const abortRef = useRef(false);

    const sendChunk = useCallback(async (blob: Blob) => {
        try {
            const form = new FormData();
            form.append('audio', blob, 'clip.webm');
            const res = await fetch('/api/recognize', { method: 'POST', body: form });
            const json = await res.json();

            if (res.ok && json.title) {
                onMatch(json as SongIdentity);
            }
            // 400/503 are expected (no match / exhausted) — silent
        } catch {
            onError('Recognition request failed', false);
        }
    }, [onMatch, onError]);

    const startRecorder = useCallback((ms: MediaStream) => {
        const recorder = new MediaRecorder(ms, {
            mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
                ? 'audio/webm;codecs=opus'
                : 'audio/webm',
        });

        recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data);
        };

        recorder.start(CHUNK_DURATION_MS);
        recorderRef.current = recorder;

        // Every CHUNK_INTERVAL_MS: grab what we have and send
        timerRef.current = setInterval(() => {
            if (abortRef.current) return;
            recorder.requestData();
            const blob = new Blob(chunksRef.current, { type: recorder.mimeType });
            chunksRef.current = [];
            if (blob.size > 1000) sendChunk(blob);
        }, CHUNK_INTERVAL_MS);
    }, [sendChunk]);

    useEffect(() => {
        abortRef.current = false;

        if (!enabled) {
            // Tear down
            timerRef.current && clearInterval(timerRef.current);
            recorderRef.current?.stop();
            stream?.getTracks().forEach(t => t.stop());
            setStream(null);
            return;
        }

        let acquired: MediaStream | null = null;

        navigator.mediaDevices.getUserMedia({ audio: true, video: false })
            .then(ms => {
                if (abortRef.current) { ms.getTracks().forEach(t => t.stop()); return; }
                acquired = ms;
                setStream(ms);
                startRecorder(ms);
            })
            .catch(err => {
                onError(`Mic permission denied: ${err.message}`, false);
            });

        return () => {
            abortRef.current = true;
            timerRef.current && clearInterval(timerRef.current);
            recorderRef.current?.state !== 'inactive' && recorderRef.current?.stop();
            acquired?.getTracks().forEach(t => t.stop());
        };
    }, [enabled, startRecorder, onError, stream]);

    return { stream };
}

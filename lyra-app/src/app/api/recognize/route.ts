/**
 * src/app/api/recognize/route.ts
 * Song recognition — 4-tier waterfall: ACRCloud → AudD → Shazam → AcoustID
 * All provider keys are read from environment variables; never exposed to the client.
 */

import crypto from 'crypto';
import { resilientFetch } from '@/lib/resilient';
import type { SongIdentity } from '@/lib/types';
import { NextRequest } from 'next/server';

// ---------------------------------------------------------------------------
// Route handler
// ---------------------------------------------------------------------------

export async function POST(req: NextRequest) {
    // -- Input validation --
    const form = await req.formData().catch(() => null);
    const audio = form?.get('audio');

    if (!form || !audio || !(audio instanceof Blob)) {
        return Response.json(
            { error: 'Missing or invalid "audio" field — must be a Blob/File' },
            { status: 400 }
        );
    }

    const audioBuffer = Buffer.from(await audio.arrayBuffer());

    // Fingerprint: SHA-256 of first ~2s of audio (approx 32 KB at 128kbps)
    const cacheKey = `recognition:${sha256(audioBuffer.subarray(0, 32_000))}`;

    try {
        const { result, source } = await resilientFetch<SongIdentity>(
            [
                { name: 'acrcloud', fn: () => recognizeACRCloud(audioBuffer) },
                { name: 'audd', fn: () => recognizeAudD(audioBuffer) },
                { name: 'shazam_rapidapi', fn: () => recognizeShazam(audioBuffer) },
                { name: 'acoustid', fn: () => recognizeAcoustID() },
            ],
            cacheKey
        );

        return Response.json({ ...result, _source: source });
    } catch {
        return Response.json(
            { error: 'Song not recognised — all providers exhausted or unavailable' },
            { status: 503 }
        );
    }
}

// ---------------------------------------------------------------------------
// Shared normaliser — all providers map to SongIdentity
// ---------------------------------------------------------------------------

function normalize(
    title: string,
    artist: string,
    playOffsetMs: number,
    isrc: string | null | undefined,
    provider: string
): SongIdentity {
    const id = sha256(`${title}:${artist}`);
    return {
        id,
        title: title.trim(),
        artist: artist.trim(),
        isrc: isrc ?? null,
        confidence: 0.95, // ACRCloud / AudD don't expose raw confidence; treat a match as high
        provider,
        detectedAt: Date.now(),
        playOffsetMs: Math.max(0, playOffsetMs),
    };
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

function signACRCloud() {
    const timestamp = Math.floor(Date.now() / 1000).toString();
    const stringToSign = [
        'POST', '/v1/identify',
        process.env.ACRCLOUD_ACCESS_KEY,
        'audio', '1', timestamp,
    ].join('\n');

    const signature = crypto
        .createHmac('sha1', process.env.ACRCLOUD_SECRET_KEY!)
        .update(stringToSign)
        .digest('base64');

    return { timestamp, signature };
}

async function recognizeACRCloud(audio: Buffer): Promise<SongIdentity> {
    const { timestamp, signature } = signACRCloud();

    const form = new FormData();
    form.append('sample', new Blob([new Uint8Array(audio)]));
    form.append('access_key', process.env.ACRCLOUD_ACCESS_KEY!);
    form.append('data_type', 'audio');
    form.append('signature_version', '1');
    form.append('signature', signature);
    form.append('sample_bytes', audio.length.toString());
    form.append('timestamp', timestamp);

    const res = await fetch(`https://${process.env.ACRCLOUD_HOST}/v1/identify`, {
        method: 'POST',
        body: form as unknown as BodyInit,
    });
    const json = await res.json();
    const t = json.metadata?.music?.[0];
    if (!t) throw new Error('ACRCloud: no match');

    return normalize(t.title, t.artists?.[0]?.name ?? 'Unknown', t.play_offset_ms ?? 0, t.external_ids?.isrc, 'acrcloud');
}

async function recognizeAudD(audio: Buffer): Promise<SongIdentity> {
    const form = new FormData();
    form.append('file', new Blob([new Uint8Array(audio)]));
    form.append('api_token', process.env.AUDD_API_TOKEN!);
    form.append('return', 'musicbrainz');

    const res = await fetch('https://api.audd.io/', {
        method: 'POST',
        body: form as unknown as BodyInit,
    });
    const json = await res.json();

    if (json.status !== 'success' || !json.result) throw new Error('AudD: no match');

    const r = json.result;

    // AudD returns timecode as "mm:ss" string — convert to milliseconds
    const playOffsetMs = parseTimecode(r.timecode ?? '0:00');

    return normalize(r.title, r.artist, playOffsetMs, r.musicbrainz?.[0]?.id ?? null, 'audd');
}

async function recognizeShazam(audio: Buffer): Promise<SongIdentity> {
    const res = await fetch('https://shazam.p.rapidapi.com/songs/detect', {
        method: 'POST',
        headers: {
            'content-type': 'text/plain',
            'x-rapidapi-host': 'shazam.p.rapidapi.com',
            'x-rapidapi-key': process.env.RAPIDAPI_KEY!,
        },
        body: audio.toString('base64'),
    });
    const json = await res.json();

    if (!json.track) throw new Error('Shazam: no match');

    return normalize(json.track.title, json.track.subtitle, 0, null, 'shazam');
}

async function recognizeAcoustID(): Promise<SongIdentity> {
    // AcoustID requires a Chromaprint fingerprint computed from raw PCM audio.
    // Computing Chromaprint server-side requires the `fpcalc` binary which is not
    // available in serverless/edge environments. This provider is intentionally
    // kept as a documented stub. To use it: compute the fingerprint client-side
    // (via WASM build of fpcalc) and send it as a separate field.
    throw new Error(
        'AcoustID: requires client-side Chromaprint fingerprint — not yet implemented'
    );
}

// ---------------------------------------------------------------------------
// Utilities
// ---------------------------------------------------------------------------

/** SHA-256 hex digest of a Buffer */
function sha256(input: Buffer | string): string {
    return crypto.createHash('sha256').update(input).digest('hex');
}

/**
 * Parse AudD timecode "mm:ss" or "m:ss" into milliseconds.
 * Falls back to 0 for unexpected formats.
 */
function parseTimecode(timecode: string): number {
    try {
        const parts = timecode.split(':').map(Number);
        if (parts.length === 2) {
            const [min, sec] = parts;
            return (min * 60 + sec) * 1000;
        }
        if (parts.length === 3) {
            const [hr, min, sec] = parts;
            return (hr * 3600 + min * 60 + sec) * 1000;
        }
    } catch { /* fall through */ }
    return 0;
}

/**
 * src/app/api/lyrics/route.ts
 * Lyrics fetch — 4-tier waterfall: LRCLIB → Musixmatch → Genius → LyricsOVH
 * Returns a canonical LyricsPayload.
 */

import { resilientFetch } from '@/lib/resilient';
import { parseLRC } from '@/lib/lrcParser';
import type { LyricsPayload, LyricLine } from '@/lib/types';

export async function GET(req: Request) {
    const { searchParams } = new URL(req.url);
    const title = searchParams.get('title');
    const artist = searchParams.get('artist');
    const isrc = searchParams.get('isrc') ?? undefined;

    if (!title || !artist) {
        return Response.json(
            { error: 'Missing required query params: title, artist' },
            { status: 400 }
        );
    }

    const cacheKey = `lyrics:${title.toLowerCase()}:${artist.toLowerCase()}`;

    try {
        const { result, source } = await resilientFetch<LyricsPayload>(
            [
                { name: 'lrclib', fn: () => fetchLRCLIB(title, artist) },
                { name: 'musixmatch', fn: () => fetchMusixmatch(title, artist, isrc) },
                { name: 'genius', fn: () => fetchGenius(title, artist) },
                { name: 'lyrics_ovh', fn: () => fetchLyricsOVH(title, artist) },
            ],
            cacheKey
        );

        return Response.json({ ...result, _source: source });
    } catch {
        return Response.json(
            { error: 'Lyrics not found — all providers exhausted or unavailable' },
            { status: 503 }
        );
    }
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function fetchLRCLIB(title: string, artist: string): Promise<LyricsPayload> {
    const url = `https://lrclib.net/api/get?track_name=${encodeURIComponent(title)}&artist_name=${encodeURIComponent(artist)}`;
    const res = await fetch(url);

    if (!res.ok) throw new Error(`LRCLIB: HTTP ${res.status}`);

    const json = await res.json();

    if (json.syncedLyrics) {
        return {
            syncedLines: parseLRC(json.syncedLyrics),
            plainText: json.plainLyrics ?? undefined,
            language: json.lang ?? undefined,
            provider: 'lrclib',
            quality: 'synced',
        };
    }

    if (json.plainLyrics) {
        return {
            syncedLines: approximateSync(json.plainLyrics),
            plainText: json.plainLyrics,
            language: json.lang ?? undefined,
            provider: 'lrclib',
            quality: 'approx',
        };
    }

    throw new Error('LRCLIB: no lyrics in response');
}

async function fetchMusixmatch(
    title: string,
    artist: string,
    isrc?: string
): Promise<LyricsPayload> {
    const base = 'https://api.musixmatch.com/ws/1.1';
    const apikey = process.env.MUSIXMATCH_KEY;

    if (!apikey) throw new Error('Musixmatch: MUSIXMATCH_KEY not configured');

    // Step 1: find the track
    const searchRes = await fetch(
        `${base}/track.search?q_track=${encodeURIComponent(title)}&q_artist=${encodeURIComponent(artist)}&apikey=${apikey}&page_size=1&page=1&s_track_rating=desc`
    );

    if (!searchRes.ok) throw new Error(`Musixmatch search: HTTP ${searchRes.status}`);

    const searchJson = await searchRes.json();
    const body = searchJson?.message?.body;

    if (!body) throw new Error('Musixmatch: unexpected search response shape');

    const trackId = body?.track_list?.[0]?.track?.track_id;
    if (!trackId) throw new Error('Musixmatch: track not found');

    // Step 2: get synced subtitle (LRC format)
    const subRes = await fetch(
        `${base}/track.subtitle.get?track_id=${trackId}&subtitle_format=lrc&apikey=${apikey}`
    );

    if (!subRes.ok) throw new Error(`Musixmatch subtitle: HTTP ${subRes.status}`);

    const subJson = await subRes.json();
    const subtitle = subJson?.message?.body?.subtitle;

    if (!subtitle?.subtitle_body) throw new Error('Musixmatch: no LRC subtitle available');

    return {
        syncedLines: parseLRC(subtitle.subtitle_body),
        plainText: subtitle.subtitle_body,
        language: subtitle.lyrics_language ?? undefined,
        provider: 'musixmatch',
        quality: 'synced',
    };
}

async function fetchGenius(title: string, artist: string): Promise<LyricsPayload> {
    const token = process.env.GENIUS_TOKEN;
    if (!token) throw new Error('Genius: GENIUS_TOKEN not configured');

    // Step 1: search for the song
    const searchRes = await fetch(
        `https://api.genius.com/search?q=${encodeURIComponent(`${title} ${artist}`)}`,
        { headers: { Authorization: `Bearer ${token}` } }
    );

    if (!searchRes.ok) throw new Error(`Genius search: HTTP ${searchRes.status}`);

    const { response } = await searchRes.json();
    const hit = response?.hits?.[0]?.result;

    if (!hit?.url) throw new Error('Genius: song not found');

    // Step 2: fetch the Genius page and extract lyrics from data-lyrics-container divs
    const pageRes = await fetch(hit.url, {
        headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LyraBot/1.0)' },
    });

    if (!pageRes.ok) throw new Error(`Genius page fetch: HTTP ${pageRes.status}`);

    const html = await pageRes.text();

    // Extract all data-lyrics-container divs and strip HTML tags
    const containers = [...html.matchAll(/data-lyrics-container="true"[^>]*>([\s\S]*?)<\/div>/g)];
    if (containers.length === 0) throw new Error('Genius: could not extract lyrics from page');

    const plain = containers
        .map(m => m[1]
            .replace(/<br\s*\/?>/gi, '\n')   // <br> → newline
            .replace(/<[^>]+>/g, '')          // strip all other tags
            .trim()
        )
        .join('\n')
        .replace(/\n{3,}/g, '\n\n')        // collapse excessive blank lines
        .trim();

    if (!plain) throw new Error('Genius: extracted lyrics were empty');

    return {
        syncedLines: approximateSync(plain),
        plainText: plain,
        language: undefined, // Genius doesn't expose language in free tier
        provider: 'genius',
        quality: 'approx',
    };
}

async function fetchLyricsOVH(title: string, artist: string): Promise<LyricsPayload> {
    const res = await fetch(
        `https://api.lyrics.ovh/v1/${encodeURIComponent(artist)}/${encodeURIComponent(title)}`
    );

    if (!res.ok) throw new Error(`LyricsOVH: HTTP ${res.status}`);

    const json = await res.json();

    if (!json.lyrics) throw new Error('LyricsOVH: no lyrics in response');

    return {
        syncedLines: approximateSync(json.lyrics),
        plainText: json.lyrics,
        language: undefined,
        provider: 'lyrics_ovh',
        quality: 'approx',
    };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Approximate sync: space lines 5 seconds apart.
 * Used for unsynced providers so the UI can show *something* scrolling.
 */
function approximateSync(plain: string): LyricLine[] {
    return plain
        .split('\n')
        .filter(l => l.trim().length > 0)
        .map((text, i) => ({ time: i * 5, text: text.trim() }));
}

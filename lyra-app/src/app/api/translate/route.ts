/**
 * src/app/api/translate/route.ts
 * Translation — 5-tier waterfall: DeepL → MyMemory → LibreTranslate → Lingva → Argos
 * Accepts an array of lyric line strings and returns translated lines in the same order.
 */

import { resilientFetch } from '@/lib/resilient';
import type { TranslationPayload } from '@/lib/types';

// Separator that is unlikely to appear in lyrics and survives most translators
const SEP = '\n||||\n';

export async function POST(req: Request) {
    // -- Input validation --
    let body: unknown;
    try {
        body = await req.json();
    } catch {
        return Response.json({ error: 'Request body must be JSON' }, { status: 400 });
    }

    const { lines, targetLang } = (body ?? {}) as { lines?: unknown; targetLang?: unknown };

    if (!Array.isArray(lines) || lines.length === 0) {
        return Response.json(
            { error: 'Missing or empty "lines" array' },
            { status: 400 }
        );
    }

    if (typeof targetLang !== 'string' || !targetLang.trim()) {
        return Response.json(
            { error: 'Missing or invalid "targetLang" string (e.g. "FR", "JA")' },
            { status: 400 }
        );
    }

    const stringLines = lines.map(String);
    const fullText = stringLines.join(SEP);

    // Cache key based on content + target language
    const cacheKey = `translate:${targetLang.toUpperCase()}:${fullText.slice(0, 128)}`;

    try {
        const { result, source } = await resilientFetch<string>(
            [
                { name: 'deepl', fn: () => translateDeepL(fullText, targetLang) },
                { name: 'mymemory', fn: () => translateMyMemory(fullText, targetLang) },
                { name: 'libretranslate', fn: () => translateLibre(fullText, targetLang) },
                { name: 'lingva', fn: () => translateLingva(fullText, targetLang) },
                { name: 'argos_local', fn: () => translateArgos(fullText, targetLang) },
            ],
            cacheKey
        );

        const translatedLines = result.split(SEP);
        const fromCache = source.startsWith('cache:');

        const payload: TranslationPayload = {
            targetLang: targetLang.toUpperCase(),
            lines: translatedLines,
            provider: fromCache ? source.slice('cache:'.length) : source,
            cached: fromCache,
        };

        return Response.json({ ...payload, _source: source });
    } catch {
        return Response.json(
            { error: 'Translation unavailable — all providers exhausted or unavailable' },
            { status: 503 }
        );
    }
}

// ---------------------------------------------------------------------------
// Provider implementations
// ---------------------------------------------------------------------------

async function translateDeepL(text: string, lang: string): Promise<string> {
    const key = process.env.DEEPL_KEY;
    if (!key) throw new Error('DeepL: DEEPL_KEY not configured');

    const res = await fetch('https://api-free.deepl.com/v2/translate', {
        method: 'POST',
        headers: {
            'Authorization': `DeepL-Auth-Key ${key}`,
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ text: [text], target_lang: lang.toUpperCase() }),
    });

    if (!res.ok) throw new Error(`DeepL: HTTP ${res.status}`);

    const json = await res.json();
    const translated = json.translations?.[0]?.text;
    if (!translated) throw new Error('DeepL: empty translation response');

    return translated;
}

async function translateMyMemory(text: string, lang: string): Promise<string> {
    // MyMemory requires explicit source; "autodetect" is their own keyword
    const langpair = `autodetect|${lang.toLowerCase()}`;
    const res = await fetch(
        `https://api.mymemory.translated.net/get?q=${encodeURIComponent(text)}&langpair=${langpair}`
    );

    if (!res.ok) throw new Error(`MyMemory: HTTP ${res.status}`);

    const json = await res.json();

    // responseStatus 200 means success; anything else is an error
    if (json.responseStatus !== 200) {
        throw new Error(`MyMemory: status ${json.responseStatus} — ${json.responseDetails ?? ''}`);
    }

    const translated = json.responseData?.translatedText;
    if (!translated) throw new Error('MyMemory: empty translation response');

    return translated;
}

async function translateLibre(text: string, lang: string): Promise<string> {
    const res = await fetch('https://libretranslate.com/translate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'auto', target: lang.toLowerCase(), format: 'text' }),
    });

    if (!res.ok) throw new Error(`LibreTranslate: HTTP ${res.status}`);

    const json = await res.json();
    if (!json.translatedText) throw new Error('LibreTranslate: empty response');

    return json.translatedText;
}

async function translateLingva(text: string, lang: string): Promise<string> {
    // Lingva is an open-source Google Translate frontend with a public API
    const res = await fetch(
        `https://lingva.ml/api/v1/auto/${lang.toLowerCase()}/${encodeURIComponent(text)}`
    );

    if (!res.ok) throw new Error(`Lingva: HTTP ${res.status}`);

    const json = await res.json();
    if (!json.translation) throw new Error('Lingva: empty response');

    return json.translation;
}

async function translateArgos(text: string, lang: string): Promise<string> {
    const base = process.env.ARGOS_URL;
    if (!base) throw new Error('Argos: ARGOS_URL not configured');

    const res = await fetch(`${base}/translate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ q: text, source: 'auto', target: lang.toLowerCase() }),
    });

    if (!res.ok) throw new Error(`Argos: HTTP ${res.status}`);

    const json = await res.json();
    if (!json.translatedText) throw new Error('Argos: empty response');

    return json.translatedText;
}

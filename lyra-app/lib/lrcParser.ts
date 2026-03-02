export interface LyricLine {
    time: number; // seconds
    text: string;
}

export function parseLRC(lrc: string): LyricLine[] {
    return lrc
        .split('\n')
        .map(line => {
            const match = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/);
            if (!match) return null;
            const [, min, sec, ms, text] = match;
            return {
                time: +min * 60 + +sec + +ms / (ms.length === 3 ? 1000 : 100),
                text: text.trim(),
            };
        })
        .filter(Boolean)
        .sort((a, b) => a!.time - b!.time) as LyricLine[];
}

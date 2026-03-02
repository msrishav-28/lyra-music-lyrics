import { parseLRC } from '../lib/lrcParser';

describe('parseLRC', () => {
    it('parses standard 2-digit millisecond timestamps', () => {
        const lrc = '[00:01.23]Hello world\n[00:05.67]Second line';
        const result = parseLRC(lrc);
        expect(result).toHaveLength(2);
        expect(result[0].time).toBeCloseTo(1.23, 2);
        expect(result[0].text).toBe('Hello world');
        expect(result[1].time).toBeCloseTo(5.67, 2);
    });

    it('parses 3-digit millisecond timestamps', () => {
        const lrc = '[00:01.230]Hello\n[00:05.670]World';
        const result = parseLRC(lrc);
        expect(result[0].time).toBeCloseTo(1.23, 2);
        expect(result[1].time).toBeCloseTo(5.67, 2);
    });

    it('handles minutes correctly', () => {
        const lrc = '[02:30.00]Two and a half minutes';
        const result = parseLRC(lrc);
        expect(result[0].time).toBeCloseTo(150.0, 1);
    });

    it('filters out lines without timestamps (metadata tags)', () => {
        const lrc = '[ar:Queen]\n[ti:Bohemian Rhapsody]\n[00:01.00]Is this the real life?';
        const result = parseLRC(lrc);
        expect(result).toHaveLength(1);
        expect(result[0].text).toBe('Is this the real life?');
    });

    it('filters out empty lines', () => {
        const lrc = '[00:01.00]Line one\n\n[00:05.00]Line two\n';
        const result = parseLRC(lrc);
        expect(result).toHaveLength(2);
    });

    it('returns empty array for empty input', () => {
        expect(parseLRC('')).toEqual([]);
    });

    it('sorts lines by time even if input is out of order', () => {
        const lrc = '[00:10.00]Third\n[00:01.00]First\n[00:05.00]Second';
        const result = parseLRC(lrc);
        expect(result[0].text).toBe('First');
        expect(result[1].text).toBe('Second');
        expect(result[2].text).toBe('Third');
    });

    it('trims whitespace from text', () => {
        const lrc = '[00:01.00]  spaces around  ';
        const result = parseLRC(lrc);
        expect(result[0].text).toBe('spaces around');
    });
});

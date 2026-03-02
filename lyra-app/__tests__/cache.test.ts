import { getCache, setCache, evictCache } from '../lib/cache';

// Mock localStorage for Node environment
const store: Record<string, string> = {};
const localStorageMock = {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
};

Object.defineProperty(global, 'window', { value: { localStorage: localStorageMock }, writable: true });
Object.defineProperty(global, 'localStorage', { value: localStorageMock, writable: true });

describe('cache', () => {
    beforeEach(() => {
        // Clear in-process L1 and L2 between tests
        Object.keys(store).forEach(k => delete store[k]);
        evictCache('test-key');
    });

    it('returns null on miss', () => {
        expect(getCache('nonexistent')).toBeNull();
    });

    it('stores and retrieves data with correct source', () => {
        setCache('test-key', { title: 'Hello' }, 'acrcloud');
        const result = getCache<{ title: string }>('test-key');
        expect(result).not.toBeNull();
        expect(result!.data.title).toBe('Hello');
        expect(result!.source).toBe('acrcloud');
    });

    it('preserves source field through round-trip', () => {
        setCache('song:1', ['line1', 'line2'], 'lrclib');
        const result = getCache<string[]>('song:1');
        expect(result!.source).toBe('lrclib');
        expect(result!.data).toEqual(['line1', 'line2']);
    });

    it('returns null after eviction', () => {
        setCache('evict-me', 42, 'deepl');
        evictCache('evict-me');
        expect(getCache('evict-me')).toBeNull();
    });

    it('does not crash in server environment (window undefined)', () => {
        const origWindow = global.window;
        // @ts-expect-error simulating server environment
        delete global.window;
        setCache('server-test', 'value', 'provider');
        const result = getCache<string>('server-test');
        // L1 should still work
        expect(result!.data).toBe('value');
        global.window = origWindow;
    });

    it('expired L2 entry returns null', () => {
        // Manually write an already-expired L2 entry
        const key = 'lyra:expired-key';
        localStorageMock.setItem(key, JSON.stringify({
            data: 'stale',
            source: 'test',
            expiresAt: Date.now() - 1000,
        }));
        expect(getCache('expired-key')).toBeNull();
        // Should also be cleaned up from localStorage
        expect(localStorageMock.getItem(key)).toBeNull();
    });
});

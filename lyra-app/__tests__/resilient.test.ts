import { resilientFetch, resetProvider, getProviderStates } from '../lib/resilient';
import { evictCache } from '../lib/cache';

// Helpers
const ok = (val: string) => () => Promise.resolve(val);
const err = (msg: string) => () => Promise.reject(new Error(msg));

function makeKey() {
    return `test:${Math.random().toString(36).slice(2)}`;
}

describe('resilientFetch', () => {
    beforeEach(() => {
        // Reset all circuit breakers between tests
        const states = getProviderStates();
        states.forEach(s => resetProvider(s.name));
    });

    it('returns result from the first provider that succeeds', async () => {
        const key = makeKey();
        const { result, source } = await resilientFetch(
            [{ name: 'p1', fn: ok('hello') }, { name: 'p2', fn: ok('world') }],
            key
        );
        expect(result).toBe('hello');
        expect(source).toBe('p1');
    });

    it('skips failed provider and returns result from second', async () => {
        const key = makeKey();
        const { result, source } = await resilientFetch(
            [{ name: 'fail1', fn: err('oops') }, { name: 'ok1', fn: ok('fallback') }],
            key
        );
        expect(result).toBe('fallback');
        expect(source).toBe('ok1');
    });

    it('throws when all providers are exhausted', async () => {
        const key = makeKey();
        await expect(
            resilientFetch(
                [{ name: 'bad1', fn: err('no') }, { name: 'bad2', fn: err('no') }],
                key
            )
        ).rejects.toThrow('All providers exhausted');
    });

    it('returns cached result on second call', async () => {
        const key = makeKey();
        // First call — from provider
        await resilientFetch([{ name: 'cached_p', fn: ok('cached-value') }], key);
        // Second call — should come from cache
        const { result, source } = await resilientFetch(
            [{ name: 'cached_p', fn: err('should not be called') }],
            key
        );
        expect(result).toBe('cached-value');
        expect(source).toMatch(/^cache:/);
    });

    it('circuit-trips provider after MAX_FAILURES consecutive failures', async () => {
        const key = makeKey();
        // Need 3 separate calls that each fail (one failure per call with only this provider)
        for (let i = 0; i < 3; i++) {
            try {
                await resilientFetch(
                    [{ name: 'trippable', fn: err('fail') }, { name: 'backup', fn: ok('ok') }],
                    makeKey()
                );
            } catch { /* expected */ }
        }
        const states = getProviderStates();
        const trippable = states.find(s => s.name === 'trippable');
        expect(trippable?.disabled).toBe(true);
    });

    it('respects timeout and treats it as a provider failure', async () => {
        const key = makeKey();
        const slowProvider = {
            name: 'slow',
            fn: () => new Promise<string>(resolve => setTimeout(() => resolve('late'), 15_000)),
        };
        // The timeout in resilientFetch is 8000ms; we mock with jest timers
        jest.useFakeTimers();
        const fetchPromise = resilientFetch(
            [slowProvider, { name: 'fast', fn: ok('fast-result') }],
            key
        );
        jest.advanceTimersByTime(9000); // advance past 8s timeout
        const { result, source } = await fetchPromise;
        expect(result).toBe('fast-result');
        expect(source).toBe('fast');
        jest.useRealTimers();
    });
});

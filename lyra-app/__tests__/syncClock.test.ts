import { createSyncClock } from '../lib/syncClock';

describe('createSyncClock', () => {
    it('returns ~0 elapsed for a fresh clock with 0 offset', () => {
        const clock = createSyncClock(0);
        const elapsed = clock.getElapsed();
        expect(elapsed).toBeGreaterThanOrEqual(0);
        expect(elapsed).toBeLessThan(0.1); // within 100ms of creation
    });

    it('accounts for play offset correctly', () => {
        // If offset is 30000ms (30 seconds into song), elapsed should be ~30
        const clock = createSyncClock(30_000);
        const elapsed = clock.getElapsed();
        expect(elapsed).toBeGreaterThanOrEqual(29.9);
        expect(elapsed).toBeLessThan(30.1);
    });

    it('advances elapsed over real time', async () => {
        const clock = createSyncClock(0);
        const before = clock.getElapsed();
        await new Promise(r => setTimeout(r, 100));
        const after = clock.getElapsed();
        expect(after - before).toBeGreaterThan(0.09);
        expect(after - before).toBeLessThan(0.3);
    });

    it('reset() re-anchors the clock to the new offset', () => {
        const clock = createSyncClock(0);
        clock.reset(60_000); // jump to 60s into the song
        const elapsed = clock.getElapsed();
        expect(elapsed).toBeGreaterThanOrEqual(59.9);
        expect(elapsed).toBeLessThan(60.1);
    });

    it('applyDrift() ignores tiny drifts (< 500ms)', () => {
        const clock = createSyncClock(10_000);
        const before = clock.getElapsed();
        // Apply a drift that's only 200ms off — should be ignored
        clock.applyDrift(10_200);
        const after = clock.getElapsed();
        // Elapsed should be within 100ms of where it was (drift ignored)
        expect(Math.abs(after - before)).toBeLessThan(0.1);
    });

    it('applyDrift() lerps toward the target for large drifts', () => {
        // Clock thinks we are at 30s; real position is 35s (5s drift = 5000ms > 500ms threshold)
        const clock = createSyncClock(30_000);
        const before = clock.getElapsed(); // ~30s
        clock.applyDrift(35_000);
        const after = clock.getElapsed();
        // After lerp (15%), elapsed should be between 30 and 35, but closer to 30
        expect(after).toBeGreaterThan(before); // it moved toward 35
        expect(after).toBeLessThan(35);         // but didn't snap fully
    });

    it('multiple applyDrift calls converge toward the target', () => {
        const clock = createSyncClock(0);
        // Repeatedly apply 60s target — should progressively move toward 60
        let prev = clock.getElapsed();
        for (let i = 0; i < 8; i++) {
            clock.applyDrift(60_000);
            const current = clock.getElapsed();
            expect(current).toBeGreaterThan(prev);
            prev = current;
        }
        // After 8 lerp steps at 15% each, we should be significantly closer to 60s
        expect(prev).toBeGreaterThan(5);
    });
});

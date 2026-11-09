import assert from 'node:assert/strict';

import { adapterTimers, type TimerHost } from '../../src/lib/timers';

/** Behaves like the timers of the adapter: it remembers them and refuses new ones while it stops */
class FakeHost {
    public stopping = false;
    public readonly timers = new Set<NodeJS.Timeout>();

    public setTimeout(callback: () => void, ms: number): unknown {
        if (this.stopping) {
            return undefined;
        }
        const timer = setTimeout(() => {
            this.timers.delete(timer);
            callback();
        }, ms);
        this.timers.add(timer);
        return timer;
    }

    public clearTimeout(timer: NodeJS.Timeout): void {
        clearTimeout(timer);
        this.timers.delete(timer);
    }

    public setInterval(callback: () => void, ms: number): unknown {
        if (this.stopping) {
            return undefined;
        }
        const timer = setInterval(callback, ms);
        this.timers.add(timer);
        return timer;
    }

    public clearInterval(timer: NodeJS.Timeout): void {
        clearInterval(timer);
        this.timers.delete(timer);
    }
}

describe('adapterTimers', () => {
    let host: FakeHost;

    beforeEach(() => {
        host = new FakeHost();
        adapterTimers.use(host as unknown as TimerHost);
    });

    afterEach(() => adapterTimers.use(null));

    it('starts and clears the timers through the adapter', async () => {
        let fired = 0;
        const timer = adapterTimers.setTimeout(() => fired++, 5);
        const cleared = adapterTimers.setTimeout(() => fired++, 5);
        const interval = adapterTimers.setInterval(() => undefined, 5);
        assert.equal(host.timers.size, 3);

        adapterTimers.clearTimeout(cleared);
        adapterTimers.clearInterval(interval);
        assert.deepEqual([...host.timers], [timer]);

        await new Promise(resolve => setTimeout(resolve, 30));
        assert.equal(fired, 1);
        assert.equal(host.timers.size, 0);
    });

    it('still fires a timeout that is started while the adapter stops', async () => {
        host.stopping = true;
        let fired = false;
        const timer = adapterTimers.setTimeout(() => (fired = true), 5);
        assert.ok(timer);
        assert.equal(host.timers.size, 0);

        await new Promise(resolve => setTimeout(resolve, 30));
        assert.equal(fired, true);
    });

    it('can clear a timeout that is started while the adapter stops', async () => {
        host.stopping = true;
        let fired = false;
        const timer = adapterTimers.setTimeout(() => (fired = true), 5);
        adapterTimers.clearTimeout(timer);

        await new Promise(resolve => setTimeout(resolve, 30));
        assert.equal(fired, false);
    });

    it('uses native timers without an adapter', async () => {
        adapterTimers.use(null);
        let fired = 0;
        const timer = adapterTimers.setInterval(() => fired++, 5);
        await new Promise(resolve => setTimeout(resolve, 30));
        adapterTimers.clearInterval(timer);
        assert.ok(fired > 0);
        assert.equal(host.timers.size, 0);
    });
});

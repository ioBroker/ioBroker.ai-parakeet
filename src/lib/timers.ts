/** The timer functions of the adapter */
export type TimerHost = Pick<ioBroker.Adapter, 'setTimeout' | 'clearTimeout' | 'setInterval' | 'clearInterval'>;

/** The handle of a timer. Timers of the adapter are native timers at runtime, only their type is branded */
export type Timer = NodeJS.Timeout;

let host: TimerHost | null = null;

/**
 * Timers for the modules in `lib`, which do not know the adapter. The adapter clears them when it stops.
 *
 * While the adapter stops, its `setTimeout` returns nothing and the timer never fires. A timer started in that
 * phase is therefore a native one: the guard in `Engine.stop()`, which kills an inference process that does not
 * end, has to fire exactly then. Without an adapter (unit tests) all timers are native.
 */
export const adapterTimers = {
    /**
     * Selects the adapter that owns the timers
     *
     * @param adapter the adapter, or null for native timers
     */
    use: (adapter: TimerHost | null): void => {
        host = adapter;
    },

    /**
     * Starts a timeout
     *
     * @param callback called when the time is over
     * @param ms the time in milliseconds
     */
    setTimeout: (callback: () => void, ms: number): Timer => {
        const timer = host?.setTimeout(callback, ms) as unknown as Timer | undefined;
        return timer ?? globalThis.setTimeout(callback, ms);
    },

    /**
     * Stops a timeout
     *
     * @param timer the handle of the timeout
     */
    clearTimeout: (timer: Timer | undefined): void => {
        if (host) {
            host.clearTimeout(timer as unknown as ioBroker.Timeout | undefined);
        } else {
            globalThis.clearTimeout(timer);
        }
    },

    /**
     * Starts an interval
     *
     * @param callback called after every interval
     * @param ms the interval in milliseconds
     */
    setInterval: (callback: () => void, ms: number): Timer => {
        const timer = host?.setInterval(callback, ms) as unknown as Timer | undefined;
        return timer ?? globalThis.setInterval(callback, ms);
    },

    /**
     * Stops an interval
     *
     * @param timer the handle of the interval
     */
    clearInterval: (timer: Timer | undefined): void => {
        if (host) {
            host.clearInterval(timer as unknown as ioBroker.Interval | undefined);
        } else {
            globalThis.clearInterval(timer);
        }
    },
};

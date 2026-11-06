/**
 * Bounded observation of when something became visible over RPC.
 *
 * It became visible after `lowerMs`, the start of the last poll that did not see it (or the start of watching), and
 * at or before `upperMs`, the response of the first poll that did. All values are milliseconds from a common origin.
 */
export interface Sighting<T> {
  value: T;
  lowerMs: number;
  upperMs: number;
  polls: number;
}

export interface PollOptions {
  intervalMs: number;
  timeoutMs: number;
  now: () => number;
  sleep?: (ms: number) => Promise<void>;
}

const defaultSleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

/** Polls `probe` until it returns a value, recording the bounds of when that value first became visible. */
export async function watch<T>(probe: () => Promise<T | undefined>, opts: PollOptions): Promise<Sighting<T>> {
  const sleep = opts.sleep ?? defaultSleep;
  const start = opts.now();
  let lastMiss = start;
  let polls = 0;
  for (;;) {
    const requested = opts.now();
    let value: T | undefined;
    try {
      value = await probe();
    } catch {
      value = undefined; // a transient RPC error is treated as a miss, and the bounds stay honest
    }
    polls += 1;
    const responded = opts.now();
    if (value !== undefined) return { value, lowerMs: lastMiss, upperMs: responded, polls };
    lastMiss = requested;
    if (responded - start > opts.timeoutMs) throw new Error(`not seen within ${opts.timeoutMs} ms (${polls} polls)`);
    await sleep(opts.intervalMs);
  }
}

/** The interval within which (b happened − a happened) must lie, given bounded sightings of a and b. */
export function hopBounds(a: { lowerMs: number; upperMs: number }, b: { lowerMs: number; upperMs: number }) {
  return { minMs: Math.max(0, b.lowerMs - a.upperMs), maxMs: b.upperMs - a.lowerMs };
}

export function median(xs: readonly number[]): number {
  if (xs.length === 0) throw new Error("median of empty list");
  const s = [...xs].sort((p, q) => p - q);
  const mid = Math.floor(s.length / 2);
  return s.length % 2 === 1 ? (s[mid] as number) : ((s[mid - 1] as number) + (s[mid] as number)) / 2;
}

/** Nearest-rank percentile (p in 0..100). */
export function percentile(xs: readonly number[], p: number): number {
  if (xs.length === 0) throw new Error("percentile of empty list");
  const s = [...xs].sort((a, b) => a - b);
  const rank = Math.max(1, Math.ceil((p / 100) * s.length));
  return s[rank - 1] as number;
}

import { describe, expect, it } from "vitest";
import { hopBounds, median, percentile, watch } from "../src/timing.js";

/** A deterministic clock: each call to now() reads the current fake time, and sleep advances it. */
function fakeClock() {
  let t = 0;
  return {
    now: () => t,
    sleep: (ms: number) => {
      t += ms;
      return Promise.resolve();
    },
    advance: (ms: number) => {
      t += ms;
    },
  };
}

describe("watch records honest visibility bounds", () => {
  it("lower bound is the start of the last missed poll, upper the response of the hit", async () => {
    const clock = fakeClock();
    let calls = 0;
    const s = await watch(
      () => {
        calls += 1;
        clock.advance(30); // each RPC round trip takes 30 ms
        return Promise.resolve(calls === 3 ? "seen" : undefined);
      },
      { intervalMs: 50, timeoutMs: 10_000, now: clock.now, sleep: clock.sleep },
    );
    // poll1 0→30 miss, sleep to 80; poll2 80→110 miss, sleep to 160; poll3 160→190 hit
    expect(s).toEqual({ value: "seen", lowerMs: 80, upperMs: 190, polls: 3 });
  });

  it("a hit on the first poll is bounded by the start of watching", async () => {
    const clock = fakeClock();
    clock.advance(1000);
    const s = await watch(
      () => {
        clock.advance(25);
        return Promise.resolve(42);
      },
      { intervalMs: 50, timeoutMs: 10_000, now: clock.now, sleep: clock.sleep },
    );
    expect(s).toMatchObject({ value: 42, lowerMs: 1000, upperMs: 1025, polls: 1 });
  });

  it("treats a thrown probe as a miss, not a sighting", async () => {
    const clock = fakeClock();
    let calls = 0;
    const s = await watch(
      () => {
        calls += 1;
        clock.advance(10);
        if (calls === 1) return Promise.reject(new Error("rpc 429"));
        return Promise.resolve("ok");
      },
      { intervalMs: 50, timeoutMs: 10_000, now: clock.now, sleep: clock.sleep },
    );
    expect(s.polls).toBe(2);
    expect(s.value).toBe("ok");
  });

  it("times out instead of waiting forever", async () => {
    const clock = fakeClock();
    await expect(
      watch(
        () => {
          clock.advance(10);
          return Promise.resolve(undefined);
        },
        { intervalMs: 50, timeoutMs: 200, now: clock.now, sleep: clock.sleep },
      ),
    ).rejects.toThrow(/not seen within 200 ms/);
  });
});

describe("hop bounds", () => {
  it("combines two bounded sightings into the interval the true gap must lie in", () => {
    expect(hopBounds({ lowerMs: 100, upperMs: 180 }, { lowerMs: 2100, upperMs: 2190 })).toEqual({ minMs: 1920, maxMs: 2090 });
  });
  it("never reports a negative minimum", () => {
    expect(hopBounds({ lowerMs: 100, upperMs: 500 }, { lowerMs: 200, upperMs: 600 }).minMs).toBe(0);
  });
});

describe("stats", () => {
  it("median handles odd and even lengths", () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 3, 2])).toBe(2.5);
  });
  it("nearest-rank p90", () => {
    expect(percentile([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 90)).toBe(9);
    expect(percentile([5], 90)).toBe(5);
  });
});

import { describe, expect, it } from "vitest";
import { getSqrtPriceAtTick, MAX_TICK, MIN_TICK } from "../src/tickmath.js";

// Expected values printed by v4-core's Solidity TickMath.getSqrtPriceAtTick (forge, 2026-11-14) and its MIN/MAX constants.
const FROM_SOLIDITY: [number, bigint][] = [
  [0, 79228162514264337593543950336n],
  [MIN_TICK, 4295128739n],
  [MAX_TICK, 1461446703485210103287273052203988822378723970342n],
  [-1, 79224201403219477170569942574n],
  [1, 79232123823359799118286999568n],
  [-1339, 74097750201827572291911215923n],
  [-1401, 73868414297108978106971939112n],
  [1401, 84976803619193847558988754361n],
  [12345, 146870458338965608271414022015n],
];

describe("TickMath port matches v4-core", () => {
  it("anchors", () => {
    for (const [t, want] of FROM_SOLIDITY) expect(getSqrtPriceAtTick(t)).toBe(want);
  });
  it("is strictly increasing in tick", () => {
    let prev = getSqrtPriceAtTick(-2000);
    for (let t = -1999; t <= 2000; t += 7) {
      const p = getSqrtPriceAtTick(t);
      expect(p > prev).toBe(true);
      prev = p;
    }
  });
});

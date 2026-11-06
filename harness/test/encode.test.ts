import { readFileSync } from "node:fs";
import { decodeFunctionData, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { positionManagerAbi } from "../src/abi.js";
import { encodeApprove, encodeArm, encodeMint, encodeSwap, planRun, type PoolKey } from "../src/encode.js";

// References come from the real toolchain, not from this code: forge (MintDemoPosition's broadcast tx for tokenId
// 7944) and `cast calldata` (2026-11-06).
const key: PoolKey = {
  currency0: "0x211De8a94B65CAA40e7B77Cfe88c6C522dc6297b",
  currency1: "0x76565356bE65F80220566C57C5681E1dEEB4b8Ef",
  fee: 3000,
  tickSpacing: 60,
  hooks: "0x0000000000000000000000000000000000000000",
};
const owner = "0x08e768752cA0F8a132cB82cB4bB4354470DD9111";
const vault = "0x641413bb227c5452ef2b968c9774bc31f5f54c98";

describe("encoders match the real toolchain byte for byte", () => {
  it("mint = forge's MintDemoPosition tx", () => {
    const fixture = JSON.parse(readFileSync(new URL("./fixtures/mint-7944.json", import.meta.url), "utf8")) as { input: Hex };
    const { args } = decodeFunctionData({ abi: positionManagerAbi, data: fixture.input });
    const deadline = args[1] as bigint;
    expect(encodeMint(key, -6000, 6000, 1_000n * 10n ** 18n, owner, deadline)).toBe(fixture.input);
  });

  it("arm = cast calldata", () => {
    expect(encodeArm(7944n, -120, true)).toBe(
      "0x8c74cddf0000000000000000000000000000000000000000000000000000000000001f08ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff880000000000000000000000000000000000000000000000000000000000000001",
    );
  });

  it("approve = cast calldata", () => {
    expect(encodeApprove(vault, 7944n)).toBe(
      "0x095ea7b3000000000000000000000000641413bb227c5452ef2b968c9774bc31f5f54c980000000000000000000000000000000000000000000000000000000000001f08",
    );
  });

  it("swap down = cast calldata", () => {
    expect(encodeSwap(key, true, 10n * 10n ** 18n)).toBe(
      "0x2229d0b4000000000000000000000000211de8a94b65caa40e7b77cfe88c6c522dc6297b00000000000000000000000076565356be65f80220566c57c5681e1deeb4b8ef0000000000000000000000000000000000000000000000000000000000000bb8000000000000000000000000000000000000000000000000000000000000003c00000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001ffffffffffffffffffffffffffffffffffffffffffffffff7538dcfb7618000000000000000000000000000000000000000000000000000000000001000276a40000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000001600000000000000000000000000000000000000000000000000000000000000000",
    );
  });
});

describe("planRun alternates direction so the price oscillates", () => {
  it("odd runs: stop-loss below, swap down", () => {
    expect(planRun(1, 0, 120)).toEqual({ exitBelow: true, zeroForOne: true, line: -120 });
  });
  it("even runs: exit above, swap up", () => {
    expect(planRun(2, -199, 120)).toEqual({ exitBelow: false, zeroForOne: false, line: -79 });
  });
});

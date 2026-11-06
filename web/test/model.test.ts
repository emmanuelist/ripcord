import { readFileSync } from "node:fs";
import { encodeErrorResult, type Hex } from "viem";
import { describe, expect, it } from "vitest";
import { positionManagerAbi, vaultAbi } from "../src/chain/abi";
import { applyPulledLog, applyVaultLog, mergeRecords } from "../src/chain/live";
import {
  blocksToExit,
  boardStatus,
  crosses,
  failureReason,
  fmtAmount,
  fmtTick,
  headroom,
  sortPositions,
  VaultStatus,
  type Position,
} from "../src/chain/model";
import { flapSteps, FLAP_ALPHABET } from "../src/components/flapSteps";

type RawLog = { address: Hex; data: Hex; topics: [Hex, ...Hex[]]; blockNumber: Hex; transactionHash: Hex };
const fixture = JSON.parse(readFileSync(new URL("./fixtures/loop-7944-logs.json", import.meta.url), "utf8")) as {
  exitLogs: RawLog[];
  lasnaLogs: RawLog[];
};
const asLog = (l: RawLog) => ({ ...l, blockNumber: BigInt(l.blockNumber) });

describe("the board reads position 7944 from its real receipts (E-009)", () => {
  const p: Position = { tokenId: 7944n, line: 0, exitBelow: true, vaultStatus: VaultStatus.Armed };
  for (const l of fixture.exitLogs) applyVaultLog(p, asLog(l));
  for (const l of fixture.lasnaLogs) applyPulledLog(p, asLog(l));

  it("decodes the Exited event exactly as verified on-chain", () => {
    expect(p.line).toBe(-120);
    expect(p.exit?.tickAtExit).toBe(-199);
    expect(p.exit?.liquidity).toBe(1000n * 10n ** 18n);
    expect(p.exit?.amount0).toBe(269170667702403216538n);
    expect(p.exit?.amount1).toBe(249299087358432603550n);
    expect(p.exit?.block).toBe(67128717n);
  });

  it("links the exit to the triggering swap (originBlock / originTxHash)", () => {
    expect(p.swap?.block).toBe(67128715n);
    expect(p.swap?.tx).toBe("0x88dea6df04ee3a74b8b0020a6dc3a5f796930fca73559c74037f5ed6a2031262");
    expect(p.lasna?.tx).toBe("0x86364e500098f45f4a3a854db410345a85201109ac33975afe27e896fe0af892");
  });

  it("shows it as DEPARTED, 2 blocks swap → exit", () => {
    expect(boardStatus(p)).toBe("departed");
    expect(blocksToExit(p)).toBe(2);
  });

  it("ignores logs for other positions", () => {
    const other: Position = { tokenId: 1n, line: 0, exitBelow: true, vaultStatus: VaultStatus.Armed };
    for (const l of fixture.exitLogs) expect(applyVaultLog(other, asLog(l))).toBe(false);
    expect(other.exit).toBeUndefined();
  });
});

describe("status words", () => {
  const base: Position = { tokenId: 1n, line: -120, exitBelow: true, vaultStatus: VaultStatus.Armed };
  it("armed until Lasna pulls, then boarding until the exit lands", () => {
    expect(boardStatus(base)).toBe("armed");
    expect(boardStatus({ ...base, lasna: { tx: "0x1", block: 1n } })).toBe("boarding");
  });
  it("failed and disarmed lines are never shown as armed", () => {
    expect(boardStatus({ ...base, vaultStatus: VaultStatus.Failed })).toBe("cancelled");
    expect(boardStatus({ ...base, vaultStatus: VaultStatus.Disarmed })).toBe("disarmed");
  });
});

describe("exit failure reasons are decoded into plain language", () => {
  it("revoked approval or moved NFT", () => {
    const data = encodeErrorResult({ abi: positionManagerAbi, errorName: "NotApproved", args: ["0x641413bb227c5452ef2b968c9774bc31f5f54c98"] });
    expect(failureReason(data)).toMatch(/no longer approved/);
  });
  it("a subscriber added after arming", () => {
    expect(failureReason(encodeErrorResult({ abi: vaultAbi, errorName: "HasSubscriber", args: [7944n] }))).toMatch(/subscriber/);
  });
  it("a burned NFT (solmate Error(string))", () => {
    const data = encodeErrorResult({ abi: [{ type: "error", name: "Error", inputs: [{ name: "m", type: "string" }] }], errorName: "Error", args: ["NOT_MINTED"] });
    expect(failureReason(data)).toMatch(/no longer exists/);
  });
  it("an empty revert", () => {
    expect(failureReason("0x")).toMatch(/without a reason/);
  });
});

describe("lines and numbers", () => {
  it("crossing includes touching the line, in both directions", () => {
    expect(crosses(-120, -120, true)).toBe(true);
    expect(crosses(-119, -120, true)).toBe(false);
    expect(crosses(180, 180, false)).toBe(true);
  });
  it("headroom is positive before the line", () => {
    expect(headroom(-515, true, -395)).toBe(120);
    expect(headroom(-79, false, -199)).toBe(120);
  });
  it("formats ticks with a true minus and amounts to cents", () => {
    expect(fmtTick(-395)).toBe("−395");
    expect(fmtAmount(269170667702403216538n)).toBe("269.17");
  });
  it("sorts newest first by default key, ties broken by tokenId", () => {
    const a: Position = { tokenId: 1n, line: 0, exitBelow: true, vaultStatus: 2, exit: { tx: "0x", block: 1n, time: 100, tickAtExit: 0, liquidity: 0n, amount0: 0n, amount1: 0n } };
    const b: Position = { ...a, tokenId: 2n, exit: { ...a.exit!, time: 200 } };
    expect(sortPositions([a, b], "time", -1).map((p) => p.tokenId)).toEqual([2n, 1n]);
  });
});

describe("split-flap steps turn forward and land on the target", () => {
  it("never moves backwards through the drum", () => {
    const seq = flapSteps("A", "D");
    expect(seq.at(-1)).toBe("D");
    const idx = seq.map((c) => FLAP_ALPHABET.indexOf(c));
    expect(idx).toEqual([...idx].sort((x, y) => x - y));
  });
  it("wraps around the drum and caps the visible steps", () => {
    const seq = flapSteps("9", "A", 6);
    expect(seq.length).toBeLessThanOrEqual(6);
    expect(seq.at(-1)).toBe("A");
  });
  it("does nothing when unchanged, and snaps characters off the drum", () => {
    expect(flapSteps("D", "D")).toEqual([]);
    expect(flapSteps("A", "→")).toEqual(["→"]);
  });
});

describe("a loop half inside the live window keeps its recorded truth (7952 regression)", () => {
  // The first live poll saw only 7952's Lasna reaction: its arm and exit on Unichain were older than the window.
  // The poll builds the base from the vault's own storage, so line and direction are real, never defaults.
  const live: Position = {
    tokenId: 7952n,
    owner: "0x08e768752cA0F8a132cB82cB4bB4354470DD9111",
    line: -636,
    exitBelow: false,
    vaultStatus: VaultStatus.Exited,
    lasna: { tx: "0xd80364cf", block: 7698779n, observedTick: -550 },
    swap: { tx: "0x1f526048", block: 67139869n, tick: -550 },
  };
  const recorded: Position = {
    ...live,
    armed: { tx: "0xaa", block: 67139860n, time: 1793992080 },
    swap: { tx: "0x1f526048", block: 67139869n, tick: -550, time: 1793992090 },
    exit: { tx: "0x292239a9", block: 67139871n, time: 1793992092, tickAtExit: -550, liquidity: 10n, amount0: 1n, amount1: 2n },
  };

  it("keeps the recorded exit when the live record lacks it, whichever answers first", () => {
    for (const m of [mergeRecords(recorded, live), mergeRecords(live, recorded)]) {
      expect(boardStatus(m)).toBe("departed");
      expect(blocksToExit(m)).toBe(2);
      expect(m.line).toBe(-636);
      expect(m.exitBelow).toBe(false);
      expect(m.swap?.time).toBe(1793992090);
    }
  });

  it("a newer arm seen live starts a new journey: the old hops are dropped", () => {
    const rearmed: Position = { ...live, vaultStatus: VaultStatus.Armed, armed: { tx: "0xbb", block: 67140000n }, lasna: undefined, swap: undefined };
    const m = mergeRecords(recorded, rearmed);
    expect(boardStatus(m)).toBe("armed");
    expect(m.exit).toBeUndefined();
  });
});

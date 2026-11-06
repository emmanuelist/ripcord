import { parseAbiItem } from "viem";
import { deploy, las, uni } from "./clients";
import type { Position } from "./model";

const lineTracked = parseAbiItem("event LineTracked(bytes32 indexed poolId, uint256 indexed tokenId, int24 triggerTick, bool exitBelow)");

/** A loop's tracking reaction comes seconds before its firing one; Lasna makes ~1 s blocks. Search well inside the 1000-block log cap. */
const TRACK_LOOKBACK = 800n;

export interface Tank {
  balance: bigint;
  /** What one real exit cost this holder, read from its balance at the blocks that charged it. */
  perExit?: bigint;
  /** Whole exits the balance still covers at that cost. */
  covers?: number;
}

export interface Funding {
  /** RipcordReactive on Lasna, in lREACT: the arm's tracking reaction plus the firing reaction. */
  reactive: Tank;
  /** RipcordVault on Unichain Sepolia, in ETH: the callback. */
  vault: Tank;
  /** The exit that priced both. */
  basis?: bigint;
}

export interface Costs {
  reactive?: bigint;
  vault?: bigint;
  basis: bigint;
}

export interface Balances {
  reactive: bigint;
  vault: bigint;
}

/** Charge taken in block `b`: Reactive debits the contract inside the reaction's own block (no gas price on the receipt). */
async function drop(chain: "u" | "l", address: `0x${string}`, b: bigint): Promise<bigint> {
  const c = chain === "u" ? uni : las;
  const [before, after] = await Promise.all([c.getBalance({ address, blockNumber: b - 1n }), c.getBalance({ address, blockNumber: b })]);
  return before - after;
}

/**
 * What one real exit cost each holder: one log query and six historical balance reads, done once per exit. A block
 * that also received a top-up shows a non-positive charge; then the cost is unknown rather than guessed.
 */
export async function readCosts(p: Position): Promise<Costs | undefined> {
  if (!p.lasna || !p.exit) return undefined;
  const [tracked, fire, callback] = await Promise.all([
    las.getLogs({
      address: deploy.ripcordReactive,
      event: lineTracked,
      args: { tokenId: p.tokenId },
      fromBlock: p.lasna.block > TRACK_LOOKBACK ? p.lasna.block - TRACK_LOOKBACK : 0n,
      toBlock: p.lasna.block,
    }),
    drop("l", deploy.ripcordReactive, p.lasna.block),
    drop("u", deploy.ripcordVault, p.exit.block),
  ]);
  const track = tracked.at(-1)?.blockNumber;
  const trackCost = track ? await drop("l", deploy.ripcordReactive, track) : undefined;
  return {
    reactive: trackCost !== undefined && trackCost > 0n && fire > 0n ? trackCost + fire : undefined,
    vault: callback > 0n ? callback : undefined,
    basis: p.tokenId,
  };
}

/** The two current balances: the only reads repeated on a timer. */
export async function readBalances(): Promise<Balances> {
  const [reactive, vault] = await Promise.all([las.getBalance({ address: deploy.ripcordReactive }), uni.getBalance({ address: deploy.ripcordVault })]);
  return { reactive, vault };
}

const covers = (balance: bigint, perExit: bigint | undefined) => (perExit && perExit > 0n ? Number(balance / perExit) : undefined);

export function combine(balances: Balances, costs: Costs | undefined): Funding {
  return {
    reactive: { balance: balances.reactive, perExit: costs?.reactive, covers: covers(balances.reactive, costs?.reactive) },
    vault: { balance: balances.vault, perExit: costs?.vault, covers: covers(balances.vault, costs?.vault) },
    basis: costs?.basis,
  };
}

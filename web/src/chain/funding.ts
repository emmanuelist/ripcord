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

/** Charge taken in block `b`: Reactive debits the contract inside the reaction's own block (no gas price on the receipt). */
async function drop(chain: "u" | "l", address: `0x${string}`, b: bigint): Promise<bigint> {
  const c = chain === "u" ? uni : las;
  const [before, after] = await Promise.all([c.getBalance({ address, blockNumber: b - 1n }), c.getBalance({ address, blockNumber: b })]);
  return before - after;
}

const covers = (balance: bigint, perExit: bigint | undefined) => (perExit && perExit > 0n ? Number(balance / perExit) : undefined);

/**
 * Current balances, and how many exits each covers at the cost of the most recent real exit. A block that also
 * received a top-up would show a non-positive charge; then the cost is unknown rather than guessed.
 */
export async function readFunding(latestExit: Position | undefined): Promise<Funding> {
  const [reactiveBal, vaultBal] = await Promise.all([
    las.getBalance({ address: deploy.ripcordReactive }),
    uni.getBalance({ address: deploy.ripcordVault }),
  ]);
  const funding: Funding = { reactive: { balance: reactiveBal }, vault: { balance: vaultBal } };
  const p = latestExit;
  if (!p?.lasna || !p.exit) return funding;

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

  const reactivePer = trackCost !== undefined && trackCost > 0n && fire > 0n ? trackCost + fire : undefined;
  const vaultPer = callback > 0n ? callback : undefined;
  return {
    reactive: { balance: reactiveBal, perExit: reactivePer, covers: covers(reactiveBal, reactivePer) },
    vault: { balance: vaultBal, perExit: vaultPer, covers: covers(vaultBal, vaultPer) },
    basis: p.tokenId,
  };
}

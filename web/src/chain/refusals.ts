import { decodeErrorResult, decodeEventLog, decodeFunctionData, numberToHex, type Hex, type Log } from "viem";
import { exitErrorsAbi, exitFailed, guardErrorsAbi, lineDisarmed, poolSwap, positionManagerAbi, ripcordPulled, stateViewAbi, vaultAbi } from "./abi";
import { deploy, las, uni } from "./clients";
import index from "../data/refusals.json";

/** The three refusals of E-016, by hash only. Every value the page shows is read back from chain below. */
interface Index {
  holds: { tokenId: string; swap: Hex; reaction: Hex };
  direct: { tokenId: string; tx: Hex; disarm: Hex };
  custody: { tokenId: string; revoke: Hex; swap: Hex; lasna: Hex; failed: Hex };
}
const refs = index as Index;

const VaultStatus = ["None", "Armed", "Exited", "Failed", "Disarmed"] as const;

export interface Hop {
  tx: Hex;
  block: bigint;
}

export interface Refusals {
  holds: {
    tokenId: bigint;
    line: number;
    exitBelow: boolean;
    tickBefore: number;
    tickAfter: number;
    swap: Hop;
    reaction: Hop & { ok: boolean; events: number; charge?: bigint };
    liquidityBefore: bigint;
    liquidity: bigint;
  };
  direct: {
    tokenId: bigint;
    from: Hex;
    claimedSender: Hex;
    tx: Hop & { reverted: boolean };
    reason?: { name: string; args: readonly unknown[] };
    disarm: Hop & { done: boolean };
    statusNow: string;
    liquidityBefore: bigint;
    liquidity: bigint;
  };
  custody: {
    tokenId: bigint;
    line: number;
    tickBefore: number;
    tickAfter: number;
    revoke: Hop;
    swap: Hop;
    lasna: Hop & { pulled: boolean };
    failed: Hop & { reason?: { name: string; args: readonly unknown[] } };
    statusNow: string;
    liquidityBefore: bigint;
    liquidity: bigint;
  };
}

function swapTick(logs: readonly Log[]): number | undefined {
  for (const l of logs) {
    if (l.address.toLowerCase() !== deploy.poolManager.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [poolSwap], data: l.data, topics: l.topics });
      if (ev.args.id.toLowerCase() === deploy.poolId.toLowerCase()) return ev.args.tick;
    } catch {
      /* not a Swap */
    }
  }
  return undefined;
}

const tickAt = async (block: bigint) =>
  (await uni.readContract({ address: deploy.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [deploy.poolId], blockNumber: block }))[1];

const liquidityOf = (tokenId: bigint, blockNumber?: bigint) =>
  uni.readContract({ address: deploy.positionManager, abi: positionManagerAbi, functionName: "getPositionLiquidity", args: [tokenId], blockNumber });

const lineOf = (tokenId: bigint) => uni.readContract({ address: deploy.ripcordVault, abi: vaultAbi, functionName: "lines", args: [tokenId] });

/** Lasna bills a reaction inside its own block: the balance drop there is its charge (no gas price on the receipt). */
async function chargeAt(block: bigint): Promise<bigint | undefined> {
  const [before, after] = await Promise.all([
    las.getBalance({ address: deploy.ripcordReactive, blockNumber: block - 1n }),
    las.getBalance({ address: deploy.ripcordReactive, blockNumber: block }),
  ]);
  return before > after ? before - after : undefined;
}

function revertData(e: unknown): Hex | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 8 && cur; i++) {
    const data = (cur as { data?: unknown }).data;
    if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) return data as Hex;
    if (data && typeof data === "object") {
      const inner = (data as { data?: unknown }).data;
      if (typeof inner === "string" && inner.startsWith("0x")) return inner as Hex;
    }
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

/** Replays a reverted transaction one block before it was mined and decodes the error the chain gives. */
async function replayReason(from: Hex, to: Hex, input: Hex, block: bigint) {
  try {
    await uni.request({ method: "eth_call", params: [{ from, to, data: input }, numberToHex(block - 1n)] });
  } catch (e) {
    const raw = revertData(e);
    if (raw) {
      try {
        const d = decodeErrorResult({ abi: [...guardErrorsAbi, ...exitErrorsAbi], data: raw });
        return { name: d.errorName, args: d.args ?? [] };
      } catch {
        return undefined;
      }
    }
  }
  return undefined;
}

export async function readRefusals(): Promise<Refusals> {
  const h = refs.holds;
  const d = refs.direct;
  const c = refs.custody;
  const [hSwap, hReaction, dTx, dRcpt, dDisarm, cRevoke, cSwap, cLasna, cFailed] = await Promise.all([
    uni.getTransactionReceipt({ hash: h.swap }),
    las.getTransactionReceipt({ hash: h.reaction }),
    uni.getTransaction({ hash: d.tx }),
    uni.getTransactionReceipt({ hash: d.tx }),
    uni.getTransactionReceipt({ hash: d.disarm }),
    uni.getTransactionReceipt({ hash: c.revoke }),
    uni.getTransactionReceipt({ hash: c.swap }),
    las.getTransactionReceipt({ hash: c.lasna }),
    uni.getTransactionReceipt({ hash: c.failed }),
  ]);
  const hId = BigInt(h.tokenId);
  const dId = BigInt(d.tokenId);
  const cId = BigInt(c.tokenId);
  const call = decodeFunctionData({ abi: vaultAbi, data: dTx.input });
  const claimedSender = call.functionName === "exit" ? call.args[0] : ("0x" as Hex);

  const [hLine, hTickBefore, hCharge, hLiq0, hLiq, dReason, dLine, dLiq0, dLiq, cLine, cTickBefore, cLiq0, cLiq] = await Promise.all([
    lineOf(hId),
    tickAt(hSwap.blockNumber - 1n),
    chargeAt(hReaction.blockNumber),
    liquidityOf(hId, hSwap.blockNumber - 1n),
    liquidityOf(hId),
    replayReason(dTx.from, dTx.to ?? deploy.ripcordVault, dTx.input, dRcpt.blockNumber),
    lineOf(dId),
    liquidityOf(dId, dRcpt.blockNumber - 1n),
    liquidityOf(dId),
    lineOf(cId),
    tickAt(cSwap.blockNumber - 1n),
    liquidityOf(cId, cSwap.blockNumber - 1n),
    liquidityOf(cId),
  ]);

  let failedReason: { name: string; args: readonly unknown[] } | undefined;
  for (const l of cFailed.logs) {
    try {
      const ev = decodeEventLog({ abi: [exitFailed], data: l.data, topics: l.topics });
      const dec = decodeErrorResult({ abi: exitErrorsAbi, data: ev.args.reason });
      failedReason = { name: dec.errorName, args: dec.args ?? [] };
    } catch {
      /* not ExitFailed */
    }
  }
  const has = (logs: readonly Log[], event: typeof lineDisarmed | typeof ripcordPulled) =>
    logs.some((l) => {
      try {
        decodeEventLog({ abi: [event], data: l.data, topics: l.topics });
        return true;
      } catch {
        return false;
      }
    });

  return {
    holds: {
      tokenId: hId,
      line: hLine[2],
      exitBelow: hLine[3],
      tickBefore: hTickBefore,
      tickAfter: swapTick(hSwap.logs) ?? hTickBefore,
      swap: { tx: h.swap, block: hSwap.blockNumber },
      reaction: { tx: h.reaction, block: hReaction.blockNumber, ok: hReaction.status === "success", events: hReaction.logs.length, charge: hCharge },
      liquidityBefore: hLiq0,
      liquidity: hLiq,
    },
    direct: {
      tokenId: dId,
      from: dTx.from,
      claimedSender,
      tx: { tx: d.tx, block: dRcpt.blockNumber, reverted: dRcpt.status === "reverted" },
      reason: dReason,
      disarm: { tx: d.disarm, block: dDisarm.blockNumber, done: dDisarm.status === "success" && has(dDisarm.logs, lineDisarmed) },
      statusNow: VaultStatus[dLine[4]] ?? String(dLine[4]),
      liquidityBefore: dLiq0,
      liquidity: dLiq,
    },
    custody: {
      tokenId: cId,
      line: cLine[2],
      tickBefore: cTickBefore,
      tickAfter: swapTick(cSwap.logs) ?? cTickBefore,
      revoke: { tx: c.revoke, block: cRevoke.blockNumber },
      swap: { tx: c.swap, block: cSwap.blockNumber },
      lasna: { tx: c.lasna, block: cLasna.blockNumber, pulled: has(cLasna.logs, ripcordPulled) },
      failed: { tx: c.failed, block: cFailed.blockNumber, reason: failedReason },
      statusNow: VaultStatus[cLine[4]] ?? String(cLine[4]),
      liquidityBefore: cLiq0,
      liquidity: cLiq,
    },
  };
}

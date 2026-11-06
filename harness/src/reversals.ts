/**
 * The M2 reversal beat: three things Ripcord refuses, each done for real on Unichain Sepolia and Lasna, with every
 * transaction's raw receipt saved. Fresh positions, minted and armed by the project wallet (D-007):
 *
 *   A. The line holds. Arm a line far below the price, then swap toward it without reaching it. RipcordReactive still
 *      reacts on Lasna (and is billed), but requests no callback: the position keeps all its liquidity, still armed.
 *   B. Only Reactive pulls the ripcord. The project wallet calls RipcordVault.exit directly on position A, even forging
 *      RipcordReactive as the injected sender. The vault reverts on-chain (NotAuthorized): A keeps its liquidity.
 *      Then the owner disarms A, the one exit an owner can always take.
 *   C. Custody stays with the owner. Arm position C, revoke the vault's approval, then swap across the line. Lasna
 *      pulls the ripcord, but the vault can't touch the NFT: it records ExitFailed with the reason, and C keeps its
 *      liquidity.
 *
 *   npm run reversals        (reads ../.env and ../docs/evidence/m1/deploy.json; writes ../docs/evidence/m2/)
 */
import { mkdir, writeFile } from "node:fs/promises";
import {
  decodeErrorResult,
  decodeEventLog,
  encodeEventTopics,
  encodeFunctionData,
  numberToHex,
  zeroAddress,
  type Address,
  type Hex,
  type PublicClient,
  type TransactionReceipt,
} from "viem";
import { exitFailed, exited, lineTracked, poolSwap, positionManagerAbi, refusalErrorsAbi, ripcordPulled, vaultAbi } from "./abi.js";
import { bigintJson, clients, currentTick, env, firstLog, loadDeploy, mintedTokenId, poolKey, sendSigned, type Deploy } from "./chain.js";
import { encodeApprove, encodeArm, encodeMint, encodeSwap, type PoolKey } from "./encode.js";
import { watch } from "./timing.js";

const SYSTEM = "0x8888888888888888888888888888888888888888";
const VaultStatus = ["None", "Armed", "Exited", "Failed", "Disarmed"] as const;
/** Far enough that one demo swap (it moved the tick 80–200 in every recorded run) can't reach the line. */
const HOLD_GAP = 1200;
/** Close enough that one demo swap always crosses. */
const CROSS_GAP = 60;
const SWAP_IN = 10n * 10n ** 18n;

interface Ctx {
  uni: PublicClient;
  las: PublicClient;
  d: Deploy;
  key: PoolKey;
  owner: Address;
  outDir: string;
  receipts: Map<Hex, unknown>;
}

const now = (() => {
  const t0 = performance.now();
  return () => performance.now() - t0;
})();

async function send(c: Ctx, to: Address, data: Hex, opts: { gasLimit?: bigint } = {}): Promise<TransactionReceipt> {
  const hash = await sendSigned(c.uni, to, data, opts);
  const r = await c.uni.waitForTransactionReceipt({ hash, pollingInterval: 250 });
  c.receipts.set(hash, r);
  // RPC visibility trails inclusion (CONTEXT.md): don't read state until the node serves this block.
  await watch(async () => ((await c.uni.getBlockNumber({ cacheTime: 0 })) >= r.blockNumber ? true : undefined), { intervalMs: 250, timeoutMs: 30_000, now });
  return r;
}

/** The pool's tick right after a swap, from the Swap event in its own receipt. */
function swapTick(c: Ctx, r: TransactionReceipt): number {
  for (const l of r.logs) {
    if (l.address.toLowerCase() !== c.d.poolManager.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [poolSwap], data: l.data, topics: l.topics });
      if (ev.args.id.toLowerCase() === c.d.poolId.toLowerCase()) return ev.args.tick;
    } catch {
      /* not a Swap */
    }
  }
  throw new Error(`no Swap event for the pool in ${r.transactionHash}`);
}

async function lasnaReceipt(c: Ctx, hash: Hex) {
  const r = await c.las.getTransactionReceipt({ hash });
  c.receipts.set(hash, r);
  return r;
}

async function liquidity(c: Ctx, tokenId: bigint): Promise<bigint> {
  return c.uni.readContract({ address: c.d.positionManager, abi: positionManagerAbi, functionName: "getPositionLiquidity", args: [tokenId] });
}

async function status(c: Ctx, tokenId: bigint): Promise<string> {
  const line = await c.uni.readContract({ address: c.d.ripcordVault, abi: vaultAbi, functionName: "lines", args: [tokenId] });
  return VaultStatus[line[4]] ?? String(line[4]);
}

async function mintApproveArm(c: Ctx, line: (tick: number) => number) {
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const mint = await send(c, c.d.positionManager, encodeMint(c.key, -6000, 6000, 1_000n * 10n ** 18n, c.owner, deadline));
  const tokenId = mintedTokenId(mint.logs, c.d.positionManager, c.owner);
  const approve = await send(c, c.d.positionManager, encodeApprove(c.d.ripcordVault, tokenId));
  const tickBefore = await currentTick(c.uni, c.d);
  const triggerTick = line(tickBefore);
  const lasFrom = await c.las.getBlockNumber();
  const arm = await send(c, c.d.ripcordVault, encodeArm(tokenId, triggerTick, true));
  const tracked = await watch(
    () => firstLog(c.las, c.d.ripcordReactive, encodeEventTopics({ abi: [lineTracked], args: { poolId: c.d.poolId, tokenId } }), lasFrom),
    { intervalMs: 500, timeoutMs: 90_000, now },
  );
  await lasnaReceipt(c, tracked.value.transactionHash);
  return { tokenId, triggerTick, tickBefore, txs: { mint: mint.transactionHash, approve: approve.transactionHash, arm: arm.transactionHash, tracked: tracked.value.transactionHash } };
}

/** The Lasna reaction to one origin transaction: a trigger(RipcordReactive, LogRecord) call to the system contract whose input carries the origin tx hash (checked against #7947's reaction). */
async function findReaction(c: Ctx, originTx: Hex, fromBlock: bigint): Promise<{ hash: Hex; block: bigint }> {
  const needleTx = originTx.slice(2).toLowerCase();
  const needleRc = c.d.ripcordReactive.slice(2).toLowerCase();
  let next = fromBlock;
  const found = await watch(
    async () => {
      const head = await c.las.getBlockNumber({ cacheTime: 0 });
      for (; next <= head; next++) {
        const b = await c.las.getBlock({ blockNumber: next, includeTransactions: true });
        for (const tx of b.transactions) {
          if (tx.to?.toLowerCase() !== SYSTEM) continue;
          const input = tx.input.toLowerCase();
          if (input.includes(needleTx) && input.includes(needleRc)) return { hash: tx.hash, block: next };
        }
      }
      return undefined;
    },
    { intervalMs: 700, timeoutMs: 120_000, now },
  );
  await lasnaReceipt(c, found.value.hash);
  return found.value;
}

/** Replays a reverted call one block before it was mined and decodes the error the chain gave. */
async function revertReason(c: Ctx, r: TransactionReceipt, data: Hex): Promise<{ raw: Hex; name: string; args: readonly unknown[] }> {
  try {
    await c.uni.call({ account: c.owner, to: r.to ?? undefined, data, blockNumber: r.blockNumber - 1n });
  } catch (e) {
    const raw = findRevertData(e);
    if (raw) {
      const dec = decodeErrorResult({ abi: refusalErrorsAbi, data: raw });
      return { raw, name: dec.errorName, args: dec.args ?? [] };
    }
    throw e;
  }
  throw new Error("the replayed call did not revert");
}

function findRevertData(e: unknown): Hex | undefined {
  let cur: unknown = e;
  for (let i = 0; i < 8 && cur; i++) {
    const data = (cur as { data?: unknown }).data;
    if (typeof data === "string" && data.startsWith("0x") && data.length >= 10) return data as Hex;
    if (data && typeof data === "object" && typeof (data as { data?: unknown }).data === "string") return (data as { data: Hex }).data;
    cur = (cur as { cause?: unknown }).cause;
  }
  return undefined;
}

async function main() {
  const d = await loadDeploy();
  const { uni, las } = await clients();
  const c: Ctx = { uni, las, d, key: poolKey(d), owner: env("DEPLOYER_ADDRESS") as Address, outDir: "../docs/evidence/m2", receipts: new Map() };
  await mkdir(`${c.outDir}/receipts`, { recursive: true });

  // ---- A. the line holds ----
  const a = await mintApproveArm(c, (t) => t - HOLD_GAP);
  const liqA0 = await liquidity(c, a.tokenId);
  const lasFromA = await las.getBlockNumber();
  const swapA = await send(c, d.swapRouter, encodeSwap(c.key, true, SWAP_IN));
  const tickAfterA = swapTick(c, swapA);
  if (tickAfterA <= a.triggerTick) throw new Error(`A: the swap crossed the line (${tickAfterA} <= ${a.triggerTick})`);
  const reactionA = await findReaction(c, swapA.transactionHash, lasFromA);
  // Give a callback, were one requested, time to land: 10 Unichain blocks, 3x the slowest recorded loop.
  await new Promise((r) => setTimeout(r, 10_000));
  const pulledA = await firstLog(las, d.ripcordReactive, encodeEventTopics({ abi: [ripcordPulled], args: { poolId: d.poolId, tokenId: a.tokenId } }), lasFromA);
  const liqA1 = await liquidity(c, a.tokenId);
  const statusA1 = await status(c, a.tokenId);
  console.log(`A · #${a.tokenId} line ${a.triggerTick} (exit at or below) · swap tick ${a.tickBefore} → ${tickAfterA} · Lasna reacted in ${reactionA.hash} · pulled: ${pulledA ? "YES" : "no"} · liquidity ${liqA0} → ${liqA1} · ${statusA1}`);
  if (pulledA || liqA1 !== liqA0 || statusA1 !== "Armed") throw new Error("A: the line did not hold");

  // ---- B. only Reactive pulls the ripcord ----
  const forged = encodeFunctionData({
    abi: vaultAbi,
    functionName: "exit",
    args: [d.ripcordReactive, a.tokenId, a.triggerTick - 60, swapA.blockNumber, BigInt(swapA.transactionHash)],
  });
  const direct = await send(c, d.ripcordVault, forged, { gasLimit: 300_000n });
  if (direct.status !== "reverted") throw new Error("B: the direct exit did not revert");
  const reasonB = await revertReason(c, direct, forged);
  const liqA2 = await liquidity(c, a.tokenId);
  const statusA2 = await status(c, a.tokenId);
  console.log(`B · direct exit on #${a.tokenId} from the wallet · ${direct.status} in ${direct.transactionHash} · ${reasonB.name}(${reasonB.args.join(", ")}) · liquidity ${liqA2} · ${statusA2}`);
  if (liqA2 !== liqA0 || statusA2 !== "Armed") throw new Error("B: the position moved");
  const disarm = await send(c, d.ripcordVault, encodeFunctionData({ abi: vaultAbi, functionName: "disarm", args: [a.tokenId] }));
  if (disarm.status !== "success") throw new Error("B: disarm failed");
  const statusA3 = await status(c, a.tokenId);
  if (statusA3 !== "Disarmed") throw new Error(`B: status after disarm is ${statusA3}`);
  console.log(`B · owner disarms #${a.tokenId} · ${disarm.transactionHash} · ${statusA3} · liquidity ${await liquidity(c, a.tokenId)}`);

  // ---- C. custody stays with the owner ----
  const cc = await mintApproveArm(c, (t) => t - CROSS_GAP);
  const liqC0 = await liquidity(c, cc.tokenId);
  const revoke = await send(c, d.positionManager, encodeApprove(zeroAddress, cc.tokenId));
  const lasFromC = await las.getBlockNumber();
  const uniFromC = await uni.getBlockNumber();
  const swapC = await send(c, d.swapRouter, encodeSwap(c.key, true, SWAP_IN));
  const tickAfterC = swapTick(c, swapC);
  const pulledC = await watch(
    () => firstLog(las, d.ripcordReactive, encodeEventTopics({ abi: [ripcordPulled], args: { poolId: d.poolId, tokenId: cc.tokenId } }), lasFromC),
    { intervalMs: 500, timeoutMs: 120_000, now },
  );
  await lasnaReceipt(c, pulledC.value.transactionHash);
  const outcome = await watch(
    () => firstLog(uni, d.ripcordVault, [[topicOf(exited), topicOf(exitFailed)], d.poolId, numberToHex(cc.tokenId, { size: 32 })], uniFromC),
    { intervalMs: 500, timeoutMs: 120_000, now },
  );
  const outcomeReceipt = await uni.getTransactionReceipt({ hash: outcome.value.transactionHash });
  c.receipts.set(outcome.value.transactionHash, outcomeReceipt);
  const ev = decodeEventLog({ abi: [exited, exitFailed], data: outcome.value.data, topics: outcome.value.topics });
  if (ev.eventName !== "ExitFailed") throw new Error("C: the exit went through despite the revoked approval");
  if (tickAfterC > cc.triggerTick) throw new Error(`C: the swap did not cross (${tickAfterC} > ${cc.triggerTick})`);
  const reasonC = decodeErrorResult({ abi: refusalErrorsAbi, data: ev.args.reason });
  const liqC1 = await liquidity(c, cc.tokenId);
  const statusC1 = await status(c, cc.tokenId);
  console.log(`C · #${cc.tokenId} approval revoked · swap tick ${cc.tickBefore} → ${tickAfterC} crosses ${cc.triggerTick} · Lasna pulled ${pulledC.value.transactionHash} · vault ExitFailed ${outcome.value.transactionHash}: ${reasonC.errorName}(${(reasonC.args ?? []).join(", ")}) · liquidity ${liqC0} → ${liqC1} · ${statusC1}`);
  if (liqC1 !== liqC0 || statusC1 !== "Failed") throw new Error("C: the position moved");

  const record = {
    measuredAt: new Date().toISOString(),
    holds: {
      tokenId: a.tokenId,
      line: a.triggerTick,
      exitBelow: true,
      tickBefore: a.tickBefore,
      tickAfter: tickAfterA,
      liquidityBefore: liqA0,
      liquidityAfter: liqA1,
      statusAfter: statusA1,
      callbackRequested: false,
      txs: { ...a.txs, swap: swapA.transactionHash, reaction: reactionA.hash },
      blocks: { swap: swapA.blockNumber, reaction: reactionA.block },
    },
    direct: {
      tokenId: a.tokenId,
      from: c.owner,
      forgedInjectedSender: d.ripcordReactive,
      tx: direct.transactionHash,
      block: direct.blockNumber,
      status: direct.status,
      gasUsed: direct.gasUsed,
      reason: reasonB,
      liquidityAfter: liqA2,
      statusAfter: statusA2,
      disarm: { tx: disarm.transactionHash, block: disarm.blockNumber, statusAfter: statusA3 },
    },
    custody: {
      tokenId: cc.tokenId,
      line: cc.triggerTick,
      exitBelow: true,
      tickBefore: cc.tickBefore,
      tickAfter: tickAfterC,
      liquidityBefore: liqC0,
      liquidityAfter: liqC1,
      statusAfter: statusC1,
      reason: { raw: ev.args.reason, name: reasonC.errorName, args: reasonC.args ?? [] },
      txs: { ...cc.txs, revoke: revoke.transactionHash, swap: swapC.transactionHash, lasna: pulledC.value.transactionHash, failed: outcome.value.transactionHash },
      blocks: { swap: swapC.blockNumber, lasna: pulledC.value.blockNumber, failed: outcome.value.blockNumber },
    },
  };
  for (const [hash, r] of c.receipts) await writeFile(`${c.outDir}/receipts/${hash}.json`, JSON.stringify(r, bigintJson, 2));
  await writeFile(`${c.outDir}/refusals.json`, JSON.stringify(record, bigintJson, 2));
  console.log(`saved ${c.receipts.size} raw receipts and ${c.outDir}/refusals.json`);
}

function topicOf(event: typeof exited | typeof exitFailed): Hex {
  const [t] = encodeEventTopics({ abi: [event] });
  if (!t || Array.isArray(t)) throw new Error("no topic0");
  return t;
}

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

import { decodeEventLog, numberToHex, type Hex, type Log } from "viem";
import { exitFailed, exited, lineArmed, lineDisarmed, positionManagerAbi, ripcordPulled, stateViewAbi, vaultAbi, vaultEvents } from "./abi";
import { deploy, las, uni } from "./clients";
import { failureReason, VaultStatus, type Position } from "./model";
import runsIndex from "../data/runs.json";

interface RunRef {
  tokenId: string;
  exitTx: Hex;
  lasnaTx: Hex;
}

/** Public Unichain RPC caps eth_getLogs at 1000 blocks; stay well inside it (docs/CONTEXT.md). */
const MAX_RANGE = 900n;

const blockTimes = new Map<string, number>();
async function blockTime(chain: "u" | "l", block: bigint): Promise<number> {
  const k = `${chain}:${block}`;
  const hit = blockTimes.get(k);
  if (hit !== undefined) return hit;
  const b = await (chain === "u" ? uni : las).getBlock({ blockNumber: block });
  const t = Number(b.timestamp);
  blockTimes.set(k, t);
  return t;
}

const asHash = (n: bigint) => numberToHex(n, { size: 32 });

/** One recorded loop, rebuilt entirely from chain by its exit and Lasna tx hashes. */
async function loadRecorded(ref: RunRef): Promise<Position | undefined> {
  const tokenId = BigInt(ref.tokenId);
  const [exitRcpt, lasnaRcpt, line] = await Promise.all([
    uni.getTransactionReceipt({ hash: ref.exitTx }),
    las.getTransactionReceipt({ hash: ref.lasnaTx }),
    uni.readContract({ address: deploy.ripcordVault, abi: vaultAbi, functionName: "lines", args: [tokenId] }),
  ]);
  const p: Position = { tokenId, owner: line[0], line: line[2], exitBelow: line[3], vaultStatus: line[4] };
  for (const l of exitRcpt.logs) applyVaultLog(p, l);
  for (const l of lasnaRcpt.logs) applyPulledLog(p, l);
  await fillTimes(p);
  return p;
}

export async function loadHistory(): Promise<Position[]> {
  const settled = await Promise.allSettled((runsIndex as RunRef[]).map(loadRecorded));
  return settled.flatMap((s) => (s.status === "fulfilled" && s.value ? [s.value] : []));
}

/** Merges two field sets, later ones winning, never letting an undefined field erase a known one. */
function defined<T extends object>(...xs: (T | undefined)[]): T | undefined {
  const out: Record<string, unknown> = {};
  let any = false;
  for (const x of xs) {
    if (!x) continue;
    for (const [k, v] of Object.entries(x)) {
      if (v === undefined) continue;
      out[k] = v;
      any = true;
    }
  }
  return any ? (out as T) : undefined;
}

const isFinal = (s: number) => s === VaultStatus.Exited || s === VaultStatus.Failed || s === VaultStatus.Disarmed;

/**
 * Two reads of one position (recorded history and a live poll, in either order) become one record. Hops combine
 * field by field, a final vault status stays final, and a newer arm starts a new journey that drops the old hops.
 */
export function mergeRecords(a: Position, b: Position): Position {
  if (a.armed && b.armed && a.armed.block !== b.armed.block) return a.armed.block > b.armed.block ? a : b;
  const base = defined(a, b) as Position;
  const vaultStatus = isFinal(b.vaultStatus) ? b.vaultStatus : isFinal(a.vaultStatus) ? a.vaultStatus : Math.max(a.vaultStatus, b.vaultStatus);
  const merged: Position = { ...base, vaultStatus };
  const hops = ["armed", "swap", "lasna", "exit", "failure"] as const;
  for (const k of hops) {
    const v = defined<object>(a[k], b[k]);
    if (v) Object.assign(merged, { [k]: v });
    else delete merged[k];
  }
  return merged;
}

/** Applies a RipcordVault event to a position. Returns true when it belonged to this position. */
export function applyVaultLog(p: Position, log: Pick<Log, "address" | "data" | "topics" | "blockNumber" | "transactionHash">): boolean {
  if (log.address.toLowerCase() !== deploy.ripcordVault.toLowerCase() || !log.blockNumber || !log.transactionHash) return false;
  let ev;
  try {
    ev = decodeEventLog({ abi: vaultEvents, data: log.data, topics: log.topics });
  } catch {
    return false;
  }
  if (ev.args.tokenId !== p.tokenId) return false;
  const hop = { tx: log.transactionHash, block: log.blockNumber };
  switch (ev.eventName) {
    case "LineArmed":
      // A re-arm starts a new journey.
      Object.assign(p, { line: ev.args.triggerTick, exitBelow: ev.args.exitBelow, owner: ev.args.owner, vaultStatus: VaultStatus.Armed, armed: hop });
      delete p.swap;
      delete p.lasna;
      delete p.exit;
      delete p.failure;
      break;
    case "LineDisarmed":
      p.vaultStatus = VaultStatus.Disarmed;
      break;
    case "Exited":
      p.vaultStatus = VaultStatus.Exited;
      p.line = ev.args.triggerTick;
      p.swap = { ...p.swap, tx: asHash(ev.args.originTxHash), block: ev.args.originBlock, tick: ev.args.observedTick };
      p.exit = { ...hop, tickAtExit: ev.args.tickAtExit, liquidity: ev.args.liquidity, amount0: ev.args.amount0, amount1: ev.args.amount1 };
      break;
    case "ExitFailed":
      p.vaultStatus = VaultStatus.Failed;
      p.failure = { ...hop, reason: failureReason(ev.args.reason) };
      break;
  }
  return true;
}

export function applyPulledLog(p: Position, log: Pick<Log, "address" | "data" | "topics" | "blockNumber" | "transactionHash">): boolean {
  if (log.address.toLowerCase() !== deploy.ripcordReactive.toLowerCase() || !log.blockNumber || !log.transactionHash) return false;
  let ev;
  try {
    ev = decodeEventLog({ abi: [ripcordPulled], data: log.data, topics: log.topics });
  } catch {
    return false;
  }
  if (ev.args.tokenId !== p.tokenId) return false;
  p.lasna = { tx: log.transactionHash, block: log.blockNumber, observedTick: ev.args.observedTick };
  p.swap = { ...p.swap, tx: p.swap?.tx ?? asHash(ev.args.originTxHash), block: ev.args.originBlock, tick: ev.args.observedTick };
  return true;
}

async function fillTimes(p: Position) {
  const jobs: Promise<void>[] = [];
  const fill = (hop: { block: bigint; time?: number } | undefined, chain: "u" | "l") => {
    if (hop && hop.time === undefined) jobs.push(blockTime(chain, hop.block).then((t) => void (hop.time = t)));
  };
  fill(p.armed, "u");
  fill(p.swap, "u");
  fill(p.exit, "u");
  fill(p.failure, "u");
  fill(p.lasna, "l");
  await Promise.all(jobs);
}

export interface Cursor {
  uni: bigint;
  lasna: bigint;
}

export interface Tick {
  uniHead: bigint;
  lasnaHead: bigint;
  poolTick: number;
  /** Positions changed this tick (new or updated), keyed by tokenId. */
  changed: Map<bigint, Position>;
  cursor: Cursor;
}

/** One poll of both chains. `known` is read, never mutated; changed positions are returned as copies. */
export async function poll(known: ReadonlyMap<bigint, Position>, cursor: Cursor | undefined): Promise<Tick> {
  const [uniHead, lasnaHead] = await Promise.all([uni.getBlockNumber({ cacheTime: 0 }), las.getBlockNumber({ cacheTime: 0 })]);
  const from = {
    uni: cursor ? cursor.uni + 1n : uniHead - MAX_RANGE,
    lasna: cursor ? cursor.lasna + 1n : lasnaHead - MAX_RANGE,
  };
  const clamp = (f: bigint, head: bigint) => (head - f > MAX_RANGE ? head - MAX_RANGE : f);
  const uFrom = clamp(from.uni, uniHead);
  const lFrom = clamp(from.lasna, lasnaHead);

  const armedIds = [...known.values()].filter((p) => p.vaultStatus === VaultStatus.Armed).map((p) => p.tokenId);
  const [vaultLogs, pulledLogs, slot0, approvals] = await Promise.all([
    uFrom <= uniHead
      ? uni.getLogs({ address: deploy.ripcordVault, events: [lineArmed, lineDisarmed, exited, exitFailed], fromBlock: uFrom, toBlock: uniHead })
      : Promise.resolve([]),
    lFrom <= lasnaHead
      ? las.getLogs({ address: deploy.ripcordReactive, event: ripcordPulled, fromBlock: lFrom, toBlock: lasnaHead })
      : Promise.resolve([]),
    uni.readContract({ address: deploy.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [deploy.poolId] }),
    armedIds.length
      ? uni.multicall({
          allowFailure: true,
          contracts: armedIds.flatMap((id) => [
            { address: deploy.positionManager, abi: positionManagerAbi, functionName: "getApproved", args: [id] } as const,
            { address: deploy.positionManager, abi: positionManagerAbi, functionName: "ownerOf", args: [id] } as const,
          ]),
        })
      : Promise.resolve([]),
  ]);

  // A position first seen in this window starts from the vault's own storage at the same head, never from defaults:
  // its arm (and line) may be older than the window while its Lasna reaction or exit is inside it.
  const ids = new Set<bigint>();
  for (const l of vaultLogs) if (l.args.tokenId !== undefined) ids.add(l.args.tokenId);
  for (const l of pulledLogs) if (l.args.tokenId !== undefined) ids.add(l.args.tokenId);
  const unseen = [...ids].filter((id) => !known.has(id));
  const stored = unseen.length
    ? await uni.multicall({
        allowFailure: false,
        blockNumber: uniHead,
        contracts: unseen.map((id) => ({ address: deploy.ripcordVault, abi: vaultAbi, functionName: "lines", args: [id] }) as const),
      })
    : [];
  const base = new Map<bigint, Position>(
    unseen.flatMap((id, i): [bigint, Position][] => {
      const row = stored[i];
      if (!row) return [];
      const [owner, , line, exitBelow, vaultStatus] = row;
      return [[id, { tokenId: id, owner, line, exitBelow, vaultStatus }]];
    }),
  );

  const changed = new Map<bigint, Position>();
  const touch = (id: bigint): Position => {
    const existing = changed.get(id) ?? known.get(id) ?? base.get(id);
    if (!existing) throw new Error(`position ${id} has no stored line`);
    const copy = structuredClone(existing);
    changed.set(id, copy);
    return copy;
  };
  for (const l of vaultLogs) {
    const id = l.args.tokenId;
    if (id !== undefined) applyVaultLog(touch(id), l);
  }
  for (const l of pulledLogs) {
    const id = l.args.tokenId;
    if (id !== undefined) applyPulledLog(touch(id), l);
  }

  // Approval: the vault must be approved on the token, or approved for all by its current owner.
  const owners: { id: bigint; owner: Hex }[] = [];
  armedIds.forEach((id, i) => {
    const approved = approvals[i * 2];
    const owner = approvals[i * 2 + 1];
    if (approved?.status !== "success" || owner?.status !== "success") return;
    const direct = approved.result.toLowerCase() === deploy.ripcordVault.toLowerCase();
    if (direct) {
      const p = known.get(id);
      if (p && p.approvalOk !== true) touch(id).approvalOk = true;
    } else owners.push({ id, owner: owner.result });
  });
  if (owners.length) {
    const all = await uni.multicall({
      allowFailure: true,
      contracts: owners.map(({ owner }) => ({ address: deploy.positionManager, abi: positionManagerAbi, functionName: "isApprovedForAll", args: [owner, deploy.ripcordVault] }) as const),
    });
    owners.forEach(({ id }, i) => {
      const ok = all[i]?.status === "success" && all[i].result === true;
      if (known.get(id)?.approvalOk !== ok) touch(id).approvalOk = ok;
    });
  }

  await Promise.all([...changed.values()].map(fillTimes));
  return { uniHead, lasnaHead, poolTick: slot0[1], changed, cursor: { uni: uniHead, lasna: lasnaHead } };
}

import raw from "../data/snapshot.json";
import type { Position } from "./model";
import type { Refusals } from "./refusals";

/**
 * The chain as it stood when the page was built (scripts/snapshot.mjs), so the first screen shows real departures in
 * the first second, server-rendered and readable without JavaScript, labelled with the block it was read at. The live
 * poll replaces it on its first answer. Nothing here is invented: it is the same reads the page makes, done earlier.
 */
export interface Snapshot {
  /** Unichain Sepolia head when the snapshot was read. */
  uniHead: bigint;
  lasnaHead: bigint;
  poolTick?: number;
  /** Wall-clock ms of the read. */
  readAt: number;
  positions: Position[];
  refusals?: Refusals;
}

/** Bigints travel as {"$n":"123"}. */
export const encode = (value: unknown): string => JSON.stringify(value, (_k, v: unknown) => (typeof v === "bigint" ? { $n: v.toString() } : v));
const revive = (_k: string, v: unknown) =>
  v && typeof v === "object" && !Array.isArray(v) && Object.keys(v).length === 1 && "$n" in v ? BigInt((v as { $n: string }).$n) : v;

export const snapshot: Snapshot | undefined = (raw as { readAt?: number }).readAt ? (JSON.parse(JSON.stringify(raw), revive) as Snapshot) : undefined;

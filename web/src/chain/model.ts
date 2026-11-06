import { decodeErrorResult, type Hex } from "viem";
import { exitErrorsAbi } from "./abi";

/** RipcordVault.Status, in contract order. */
export const VaultStatus = { None: 0, Armed: 1, Exited: 2, Failed: 3, Disarmed: 4 } as const;

/** What the board shows. "boarding" = Lasna pulled the ripcord, the exit has not landed yet. */
export type BoardStatus = "armed" | "boarding" | "departed" | "cancelled" | "disarmed";

export const statusWord: Record<BoardStatus, string> = {
  armed: "ARMED",
  boarding: "BOARDING",
  departed: "DEPARTED",
  cancelled: "CANCELLED",
  disarmed: "DISARMED",
};

export const statusTone: Record<BoardStatus, "yellow" | "amber" | "green" | "red" | "dim"> = {
  armed: "yellow",
  boarding: "amber",
  departed: "green",
  cancelled: "red",
  disarmed: "dim",
};

export interface Hop {
  tx: Hex;
  block: bigint;
  /** Block timestamp, seconds. Undefined until fetched. */
  time?: number;
}

export interface Position {
  tokenId: bigint;
  owner?: Hex;
  line: number;
  exitBelow: boolean;
  vaultStatus: number;
  armed?: Hop;
  swap?: Hop & { tick?: number };
  lasna?: Hop & { observedTick?: number };
  exit?: Hop & { tickAtExit: number; liquidity: bigint; amount0: bigint; amount1: bigint };
  failure?: Hop & { reason: string };
  approvalOk?: boolean;
}

export function boardStatus(p: Position): BoardStatus {
  if (p.exit || p.vaultStatus === VaultStatus.Exited) return "departed";
  if (p.failure || p.vaultStatus === VaultStatus.Failed) return "cancelled";
  if (p.vaultStatus === VaultStatus.Disarmed) return "disarmed";
  if (p.lasna) return "boarding";
  return "armed";
}

/** Whole Unichain blocks from the crossing swap to the exit: the chain's own resolution (no smoothed milliseconds). */
export function blocksToExit(p: Position): number | undefined {
  const from = p.swap?.block;
  const to = p.exit?.block ?? p.failure?.block;
  if (from === undefined || to === undefined) return undefined;
  return Number(to - from);
}

/** Seconds on the pool chain's clock between the crossing swap's block and the exit's block. */
export function secondsToExit(p: Position): number | undefined {
  const a = p.swap?.time;
  const b = p.exit?.time;
  return a !== undefined && b !== undefined ? b - a : undefined;
}

/** Ticks of headroom before an armed line fires (positive = not yet crossed). */
export function headroom(line: number, exitBelow: boolean, tickNow: number): number {
  return exitBelow ? tickNow - line : line - tickNow;
}

export function crosses(tick: number, line: number, exitBelow: boolean): boolean {
  return exitBelow ? tick <= line : tick >= line;
}

/** A plain-language reason for a failed exit, decoded from ExitFailed.reason. */
export function failureReason(reason: Hex): string {
  if (reason === "0x" || reason.length < 10) return "The exit reverted without a reason.";
  try {
    const e = decodeErrorResult({ abi: exitErrorsAbi, data: reason });
    switch (e.errorName) {
      case "NotApproved":
        return "The vault is no longer approved on this position (approval revoked or NFT moved).";
      case "HasSubscriber":
        return "The position gained a subscriber, which Ripcord refuses to call during an exit.";
      case "NoLiquidity":
        return "The position had no liquidity left to remove.";
      case "Error": {
        // viem decodes the standard Error(string) itself. solmate's ERC721 uses it, e.g. "NOT_MINTED" for a burned NFT.
        const message = e.args[0];
        return message === "NOT_MINTED" ? "The position NFT no longer exists." : `The exit reverted: ${message}.`;
      }
      default:
        return `The exit reverted with ${e.errorName}.`;
    }
  } catch {
    return `The exit reverted (${reason.slice(0, 10)}).`;
  }
}

export const shortHash = (h: string) => `${h.slice(0, 6)}…${h.slice(-4)}`;

/** Ticks and block numbers use a true minus and thin grouping so columns align in tabular numerals. */
export const fmtTick = (t: number) => (t < 0 ? `−${Math.abs(t)}` : String(t));
export const fmtInt = (n: bigint | number) => Number(n).toLocaleString("en-US");

export function fmtUtc(seconds?: number): string {
  if (seconds === undefined) return "—";
  return new Date(seconds * 1000).toISOString().slice(11, 19);
}

/** Token amounts (18 decimals) to two places, e.g. 269.17. */
export function fmtAmount(wei: bigint): string {
  const cents = (wei * 100n) / 10n ** 18n;
  const whole = cents / 100n;
  const frac = (cents % 100n).toString().padStart(2, "0");
  return `${whole.toLocaleString("en-US")}.${frac}`;
}

export type SortKey = "time" | "position" | "status" | "blocks";

const statusRank: Record<BoardStatus, number> = { boarding: 0, armed: 1, departed: 2, cancelled: 3, disarmed: 4 };

export function eventTime(p: Position): number {
  return p.exit?.time ?? p.failure?.time ?? p.lasna?.time ?? p.swap?.time ?? p.armed?.time ?? 0;
}

export function sortPositions(rows: readonly Position[], key: SortKey, dir: 1 | -1): Position[] {
  const v = (p: Position): number => {
    switch (key) {
      case "time":
        return eventTime(p);
      case "position":
        return Number(p.tokenId);
      case "status":
        return statusRank[boardStatus(p)];
      case "blocks":
        return blocksToExit(p) ?? Number.MAX_SAFE_INTEGER;
    }
  };
  return [...rows].sort((a, b) => (v(a) - v(b)) * dir || Number(b.tokenId - a.tokenId));
}

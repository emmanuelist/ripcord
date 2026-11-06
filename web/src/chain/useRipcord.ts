import { useEffect, useRef, useState } from "react";
import { loadHistory, mergeRecords, poll, type Cursor } from "./live";
import { boardStatus, statusWord, type Position } from "./model";

export interface RipcordState {
  positions: Map<bigint, Position>;
  uniHead?: bigint;
  lasnaHead?: bigint;
  poolTick?: number;
  /** Wall-clock ms of the last successful poll. */
  updatedAt?: number;
  loading: boolean;
  error?: string;
  /** Latest status change, phrased for the screen-reader live region. */
  announcement: string;
}

const POLL_MS = 1500;
const HIDDEN_POLL_MS = 10_000;

/** Polls Unichain Sepolia and Lasna and keeps the board's positions current. Every value comes from chain. */
export function useRipcord(): RipcordState {
  const [state, setState] = useState<RipcordState>({ positions: new Map(), loading: true, announcement: "" });
  const positions = useRef(new Map<bigint, Position>());
  const cursor = useRef<Cursor | undefined>(undefined);
  // "Loading" lasts until both the first live poll and the recorded history have answered, so the board never flashes
  // "no departures" while history is still in flight.
  const pending = useRef({ poll: true, history: true });

  useEffect(() => {
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const announce = (before: Position | undefined, after: Position): string | undefined => {
      const a = before ? boardStatus(before) : undefined;
      const b = boardStatus(after);
      if (a === b) return undefined;
      return `Position ${after.tokenId} ${statusWord[b].toLowerCase()}.`;
    };

    const tick = async () => {
      try {
        const t = await poll(positions.current, cursor.current);
        if (stopped) return;
        cursor.current = t.cursor;
        pending.current.poll = false;
        const notes: string[] = [];
        for (const [id, next] of t.changed) {
          // Merge, never replace: history may have landed while this poll was in flight.
          const prev = positions.current.get(id);
          const p = prev ? mergeRecords(prev, next) : next;
          const note = announce(prev, p);
          if (note) notes.push(note);
          positions.current.set(id, p);
        }
        setState((s) => ({
          positions: new Map(positions.current),
          uniHead: t.uniHead,
          lasnaHead: t.lasnaHead,
          poolTick: t.poolTick,
          updatedAt: Date.now(),
          loading: pending.current.history,
          error: undefined,
          announcement: notes.length ? notes.join(" ") : s.announcement,
        }));
      } catch (e) {
        if (stopped) return;
        pending.current.poll = false;
        setState((s) => ({ ...s, loading: pending.current.history, error: e instanceof Error ? e.message : String(e) }));
      } finally {
        if (!stopped) timer = setTimeout(() => void tick(), document.hidden ? HIDDEN_POLL_MS : POLL_MS);
      }
    };

    // The live poll and the recorded history start together, and merge field by field for the same id.
    void tick();
    void loadHistory()
      .then((rows) => {
        if (stopped) return;
        for (const p of rows) {
          const live = positions.current.get(p.tokenId);
          positions.current.set(p.tokenId, live ? mergeRecords(p, live) : p);
        }
      })
      .catch(() => undefined) // history is best-effort; the live poll reports RPC trouble
      .finally(() => {
        if (stopped) return;
        pending.current.history = false;
        setState((s) => ({ ...s, positions: new Map(positions.current), loading: pending.current.poll }));
      });

    const onVisible = () => {
      if (!document.hidden && timer) {
        clearTimeout(timer);
        void tick();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return state;
}

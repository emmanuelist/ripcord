import { useEffect, useState } from "react";
import { combine, readBalances, readCosts, type Balances, type Costs, type Funding } from "./funding";
import type { Position } from "./model";

const REFRESH_MS = 30_000;

/**
 * Balances and the exits they cover. The cost of an exit is derived once per new exit (one log query and six
 * historical balance reads); the 30 s timer re-reads only the two current balances, inside the page's RPC budget.
 */
export function useFunding(latestExit: Position | undefined): Funding | undefined {
  const [costs, setCosts] = useState<Costs | undefined>(undefined);
  const [balances, setBalances] = useState<Balances | undefined>(undefined);
  const key = latestExit?.exit && latestExit.lasna ? `${latestExit.tokenId}:${latestExit.exit.block}:${latestExit.lasna.block}` : "";

  useEffect(() => {
    if (!key || !latestExit) return;
    let stopped = false;
    readCosts(latestExit)
      .then((c) => !stopped && setCosts(c))
      .catch(() => undefined); // keep the last good costs; the shell's liveness reports RPC trouble
    return () => {
      stopped = true;
    };
    // The key is the exit's identity; the object itself is a fresh copy on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  useEffect(() => {
    let stopped = false;
    const read = () =>
      readBalances()
        .then((b) => !stopped && setBalances(b))
        .catch(() => undefined);
    void read();
    // A new exit also moves both balances: re-read them with it.
    const id = setInterval(() => void read(), REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
  }, [key]);

  return balances ? combine(balances, costs) : undefined;
}

export type FundingState = "in-service" | "low" | "unfunded";

/** Tone and word always paired: in service at 3 exits or more, low below 3, unfunded below 1. */
export function fundingState(covers: number | undefined): FundingState | undefined {
  if (covers === undefined) return undefined;
  if (covers < 1) return "unfunded";
  if (covers < 3) return "low";
  return "in-service";
}

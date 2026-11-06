import { useEffect, useState } from "react";
import { readFunding, type Funding } from "./funding";
import type { Position } from "./model";

const REFRESH_MS = 30_000;

/** Balances and the exits they cover, re-read whenever a new exit lands and every 30 s. */
export function useFunding(latestExit: Position | undefined): Funding | undefined {
  const [funding, setFunding] = useState<Funding | undefined>(undefined);
  const key = latestExit ? `${latestExit.tokenId}:${latestExit.exit?.block ?? ""}:${latestExit.lasna?.block ?? ""}` : "";

  useEffect(() => {
    let stopped = false;
    const read = () =>
      readFunding(latestExit)
        .then((f) => !stopped && setFunding(f))
        .catch(() => undefined); // keep the last good reading; the shell's liveness reports RPC trouble
    void read();
    const id = setInterval(() => void read(), REFRESH_MS);
    return () => {
      stopped = true;
      clearInterval(id);
    };
    // The key captures what matters about the exit; the object itself is a fresh copy on every poll.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);

  return funding;
}

export type FundingState = "in-service" | "low" | "unfunded";

/** Tone and word always paired: in service at 3 exits or more, low below 3, unfunded below 1. */
export function fundingState(covers: number | undefined): FundingState | undefined {
  if (covers === undefined) return undefined;
  if (covers < 1) return "unfunded";
  if (covers < 3) return "low";
  return "in-service";
}

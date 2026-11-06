import { fmtInt } from "../chain/model";
import { Flap } from "./Flap";

export function Shell({
  uniHead,
  lasnaHead,
  updatedAt,
  error,
  now,
}: {
  uniHead?: bigint;
  lasnaHead?: bigint;
  updatedAt?: number;
  error?: string;
  now: number;
}) {
  const age = updatedAt ? Math.max(0, Math.round((now - updatedAt) / 1000)) : undefined;
  const live = age !== undefined && age < 6 && !error;
  const state = error && (age === undefined || age >= 6) ? "down" : live ? "live" : age === undefined ? "wait" : "stale";
  const word = { live: "Live", stale: `Stale · ${age ?? 0} s`, down: "RPC unreachable · retrying", wait: "Connecting" }[state];

  return (
    <header className="shell">
      <a className="brand" href="#top" aria-label="Ripcord, top of page">
        <Flap text="RIPCORD" tone="yellow" size="s" />
      </a>
      <nav className="sections" aria-label="Sections">
        <a href="#console">Console</a>
        <a href="#how">How it works</a>
        <a href="#limits">Limits</a>
        <a href="#contracts">Contracts</a>
      </nav>
      <div className="heads">
        <span className="head">
          Unichain Sepolia <b className="num">{uniHead !== undefined ? `#${fmtInt(uniHead)}` : "—"}</b>
        </span>
        <span className="head">
          Reactive Lasna <b className="num">{lasnaHead !== undefined ? `#${fmtInt(lasnaHead)}` : "—"}</b>
        </span>
        <span className={`liveness ${state}`} role="status">
          {word}
        </span>
      </div>
      <span className="ro">Read-only</span>
    </header>
  );
}

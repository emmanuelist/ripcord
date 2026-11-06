import { blocksToExit, boardStatus, eventTime, fmtInt, fmtTick, fmtUtc, headroom, secondsToExit, type Position } from "../chain/model";
import { Flap } from "./Flap";

export function LeadStrip({ positions, tickNow }: { positions: Position[]; tickNow?: number }) {
  const armed = positions.filter((p) => boardStatus(p) === "armed");
  const nearest =
    tickNow === undefined
      ? undefined
      : armed.map((p) => ({ p, room: headroom(p.line, p.exitBelow, tickNow) })).sort((a, b) => a.room - b.room)[0];
  const lastExit = positions
    .filter((p) => p.exit)
    .sort((a, b) => eventTime(b) - eventTime(a))[0];
  const blocks = lastExit ? blocksToExit(lastExit) : undefined;
  const secs = lastExit ? secondsToExit(lastExit) : undefined;

  return (
    <section className="lead" aria-label="Pool and last exit">
      <div className="lead-cell">
        <p className="lead-label">Pool tick now</p>
        <Flap text={tickNow !== undefined ? fmtTick(tickNow) : "    "} tone={tickNow !== undefined ? "ink" : "dim"} size="xl" />
        <p className="lead-sub">
          {nearest
            ? `Nearest armed line: tick ${fmtTick(nearest.p.line)}, exit ${nearest.p.exitBelow ? "at or below" : "at or above"} · ${fmtInt(Math.abs(nearest.room))} ticks ${nearest.room >= 0 ? "away" : "past, waiting for a swap"}`
            : "No line armed right now."}
        </p>
      </div>
      <div className="lead-cell">
        <p className="lead-label">Last exit, swap to exit</p>
        <Flap text={blocks !== undefined ? `${blocks} ${blocks === 1 ? "BLOCK" : "BLOCKS"}` : "    "} tone={blocks !== undefined ? "green" : "dim"} size="xl" />
        <p className="lead-sub">
          {lastExit
            ? `Position #${lastExit.tokenId} · ${secs !== undefined ? `${secs} s on Unichain's clock · ` : ""}${fmtUtc(lastExit.exit?.time)} UTC`
            : "No exit recorded yet."}
        </p>
      </div>
    </section>
  );
}

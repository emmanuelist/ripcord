import { blocksToExit, boardStatus, eventTime, fmtInt, fmtTick, fmtUtc, headroom, secondsToExit, type Position } from "../chain/model";
import { Flap } from "./Flap";

/** The tick against the line, both at display scale, then the last exit. With nothing armed, the last crossed line. */
export function LeadStrip({ positions, tickNow }: { positions: Position[]; tickNow?: number }) {
  const armed = positions.filter((p) => boardStatus(p) === "armed");
  const nearest =
    tickNow === undefined
      ? undefined
      : armed.map((p) => ({ p, room: headroom(p.line, p.exitBelow, tickNow) })).sort((a, b) => a.room - b.room)[0];
  const byNewest = [...positions].sort((a, b) => eventTime(b) - eventTime(a));
  const lastExit = byNewest.find((p) => p.exit);
  const lastCrossed = byNewest.find((p) => p.swap);
  const shownLine = nearest?.p ?? lastCrossed;
  const blocks = lastExit ? blocksToExit(lastExit) : undefined;
  const secs = lastExit ? secondsToExit(lastExit) : undefined;

  const lineLabel = nearest ? `Nearest armed line · #${nearest.p.tokenId}` : lastCrossed ? `Last line crossed · #${lastCrossed.tokenId}` : "Line";
  const lineSub = nearest
    ? `${fmtInt(Math.abs(nearest.room))} ticks ${nearest.room >= 0 ? "of headroom" : "past, waiting for a swap"}, exit ${nearest.p.exitBelow ? "at or below" : "at or above"}`
    : lastCrossed?.swap?.tick !== undefined
      ? `Crossed by the swap to tick ${fmtTick(lastCrossed.swap.tick)}. No line armed right now.`
      : "No line armed right now.";

  return (
    <section className="lead" aria-label="Pool tick, line and last exit">
      <div className="lead-cell">
        <p className="lead-label">Pool tick now</p>
        <Flap text={tickNow !== undefined ? fmtTick(tickNow) : "    "} tone={tickNow !== undefined ? "ink" : "dim"} size="xl" />
        <div className="line-readout">
          <p className="lead-label">{lineLabel}</p>
          <Flap
            text={shownLine ? `LINE ${fmtTick(shownLine.line)}` : "         "}
            tone={nearest ? "yellow" : "dim"}
            size="l"
          />
          <p className="lead-sub">{lineSub}</p>
        </div>
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

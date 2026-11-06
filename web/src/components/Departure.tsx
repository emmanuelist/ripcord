import { useEffect, useState } from "react";
import { txUrl } from "../chain/clients";
import {
  blocksToExit,
  boardStatus,
  fmtAmount,
  fmtInt,
  fmtTick,
  headroom,
  secondsToExit,
  shortHash,
  statusTone,
  statusWord,
  VaultStatus,
  type Position,
} from "../chain/model";
import { Flap } from "./Flap";

/** One fixed whole-block scale for every loop, so runs compare at a glance. */
const SCALE_BLOCKS = 8;
const LEAD_IN_S = 0.8;
const HOLD_S = 1.2;

/**
 * Replays a real recorded loop at chain speed: the swap lands, Lasna reacts, and the exit lands as many Unichain
 * seconds later as it did on-chain (from the swap and exit blocks' own timestamps). Nothing is invented: the replay
 * only withholds each recorded hop until its moment. Lasna's clock skews against Unichain's, so the reaction is
 * shown between the two Unichain hops rather than at a claimed instant.
 */
function useReplay(p: Position | undefined) {
  const [start, setStart] = useState<number | undefined>(undefined);
  const [now, setNow] = useState(0);
  const duration = p ? Math.max(1, secondsToExit(p) ?? blocksToExit(p) ?? 1) : 1;

  const total = LEAD_IN_S + duration + HOLD_S;
  useEffect(() => {
    if (start === undefined) return;
    const id = setInterval(() => {
      const t = performance.now();
      if ((t - start) / 1000 >= total) setStart(undefined);
      else setNow(t);
    }, 80);
    return () => clearInterval(id);
  }, [start, total]);

  const elapsed = start === undefined ? undefined : Math.max(0, (now - start) / 1000);
  const playing = elapsed !== undefined && elapsed < total;

  const canReplay = !!(p?.swap && p.exit && p.swap.time !== undefined && p.exit.time !== undefined);
  const play = () => {
    const t = performance.now();
    setStart(t);
    setNow(t);
  };

  let shown = p;
  let counting: number | undefined;
  if (p && elapsed !== undefined && playing) {
    const t = elapsed - LEAD_IN_S;
    const blocks = blocksToExit(p) ?? duration;
    if (t < 0) shown = { ...p, swap: undefined, lasna: undefined, exit: undefined, vaultStatus: VaultStatus.Armed };
    else if (t < duration / 2) shown = { ...p, lasna: undefined, exit: undefined, vaultStatus: VaultStatus.Armed };
    else if (t < duration) shown = { ...p, exit: undefined, vaultStatus: VaultStatus.Armed };
    counting = t < 0 ? undefined : Math.min(blocks, Math.floor((t / duration) * blocks));
  }
  return { shown, playing, canReplay, play, counting };
}

function Stop({
  k,
  chain,
  block,
  lit,
  tone,
  children,
}: {
  k: string;
  chain: string;
  block?: bigint;
  lit: boolean;
  tone: "yellow" | "amber" | "green" | "red";
  children: React.ReactNode;
}) {
  return (
    <li className={`stop${lit ? ` lit tone-${tone}` : ""}`}>
      <span className="lamp" aria-hidden="true" />
      <span className="stop-k">{k}</span>
      <span className="stop-chain">
        {chain}
        {block !== undefined && <span className="num"> · #{fmtInt(block)}</span>}
      </span>
      <span className="stop-v">{children}</span>
    </li>
  );
}

export function Departure({ p, tickNow }: { p?: Position; tickNow?: number }) {
  const { shown, playing, canReplay, play, counting } = useReplay(p);
  if (!shown) {
    return (
      <section className="departure" id="departure" aria-label="Featured departure">
        <p className="dep-empty">Reading the latest departure from Unichain Sepolia and Lasna…</p>
      </section>
    );
  }
  const status = boardStatus(shown);
  const blocks = blocksToExit(shown);
  const secs = secondsToExit(shown);
  const armed = status === "armed";
  const tickLabel = armed && !playing ? "Pool tick now" : "Swap tick";
  const tickValue = armed && !playing ? tickNow : shown.swap?.tick;
  const room = armed && tickNow !== undefined && !playing ? headroom(shown.line, shown.exitBelow, tickNow) : undefined;
  const counted = counting ?? (shown.exit ? blocks : undefined);
  const failure = shown.failure;

  return (
    <section className="departure" id="departure" aria-label={`Departure of position ${shown.tokenId}`}>
      <header className="dep-head">
        <h2 className="dep-title" tabIndex={-1}>
          <span className="sr-only">Position </span>
          <Flap text={`#${shown.tokenId}`} size="m" />
        </h2>
        <Flap text={statusWord[status]} tone={statusTone[status]} size="m" />
        {canReplay && (
          <button type="button" className="replay" onClick={play} disabled={playing}>
            <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
              <path d="M2.5 7a4.5 4.5 0 1 0 1.4-3.3" />
              <path d="M2 1.8v2.8h2.8" />
            </svg>
            {playing ? "Replaying at chain speed" : "Replay this departure"}
          </button>
        )}
      </header>

      <div className="dep-readouts">
        <div>
          <p className="dep-label">{tickLabel}</p>
          <Flap text={tickValue !== undefined ? fmtTick(tickValue) : "    "} tone={tickValue !== undefined ? "ink" : "dim"} size="l" />
        </div>
        <div>
          <p className="dep-label">Line · exit {shown.exitBelow ? "at or below" : "at or above"}</p>
          <Flap text={fmtTick(shown.line)} tone="yellow" size="l" />
        </div>
        <div>
          <p className="dep-label">Swap to exit</p>
          <Flap text={counted !== undefined ? `${counted} ${counted === 1 ? "BLOCK" : "BLOCKS"}` : "    "} tone={counted !== undefined ? "green" : "dim"} size="l" />
        </div>
      </div>

      <ol className="route" aria-label="Calling at">
        <Stop k="Swap" chain="Unichain Sepolia" block={shown.swap?.block} lit={!!shown.swap} tone="yellow">
          {shown.swap ? (
            <>
              <span className="stop-line">
                tick → {fmtTick(shown.swap.tick ?? 0)}, <strong className="crossed">crosses {fmtTick(shown.line)}</strong>
              </span>
              <a className="hash" href={txUrl("unichain", shown.swap.tx)} target="_blank" rel="noreferrer">{shortHash(shown.swap.tx)}</a>
            </>
          ) : room !== undefined ? (
            `Waiting · ${fmtInt(Math.abs(room))} ticks ${room >= 0 ? "of headroom" : "past the line"}`
          ) : (
            "Waiting for a swap to cross the line"
          )}
        </Stop>
        <Stop k="React" chain="Reactive Lasna" block={shown.lasna?.block} lit={!!shown.lasna} tone="amber">
          {shown.lasna ? (
            <>
              <span className="stop-line">ripcord pulled</span>
              <a className="hash" href={txUrl("lasna", shown.lasna.tx)} target="_blank" rel="noreferrer">{shortHash(shown.lasna.tx)}</a>
            </>
          ) : (
            "RipcordReactive"
          )}
        </Stop>
        <Stop k={failure ? "Failed" : "Exit"} chain="Unichain Sepolia" block={shown.exit?.block ?? failure?.block} lit={!!(shown.exit || failure)} tone={failure ? "red" : "green"}>
          {shown.exit ? (
            <>
              <span className="stop-line">all liquidity to the owner</span>
              <a className="hash" href={txUrl("unichain", shown.exit.tx)} target="_blank" rel="noreferrer">{shortHash(shown.exit.tx)}</a>
            </>
          ) : failure ? (
            <>
              <span className="stop-line">{failure.reason}</span>
              <a className="hash" href={txUrl("unichain", failure.tx)} target="_blank" rel="noreferrer">{shortHash(failure.tx)}</a>
            </>
          ) : (
            "RipcordVault"
          )}
        </Stop>
      </ol>

      <div className="dep-foot">
        <figure className="scale" aria-label={blocks !== undefined ? `${blocks} Unichain blocks from the crossing swap to the exit` : "Block scale"}>
          <div className="scale-cells" aria-hidden="true">
            {Array.from({ length: SCALE_BLOCKS }, (_, i) => (
              <i key={i} className={counted !== undefined && i < counted ? "on" : ""} />
            ))}
          </div>
          <figcaption>
            <span>{blocks !== undefined && !playing ? `${blocks} Unichain ${blocks === 1 ? "block" : "blocks"}${secs !== undefined ? `, ${secs} s on Unichain's clock` : ""}` : "One cell per Unichain block"}</span>
            <span className="scale-end">{SCALE_BLOCKS} blocks</span>
          </figcaption>
        </figure>
        {shown.exit && !playing && (
          <dl className="returned">
            <div>
              <dt>Returned RDA</dt>
              <dd className="num">{fmtAmount(shown.exit.amount0)}</dd>
            </div>
            <div>
              <dt>Returned RDB</dt>
              <dd className="num">{fmtAmount(shown.exit.amount1)}</dd>
            </div>
          </dl>
        )}
      </div>
      <p className="sr-only" aria-live="polite">
        {playing ? `Replaying position ${shown.tokenId} at chain speed.` : ""}
      </p>
    </section>
  );
}

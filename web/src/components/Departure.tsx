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

/** The ruler shows this many Unichain blocks from the crossing swap: one fixed scale, so every loop compares at a glance. */
const SCALE_BLOCKS = 8;
const LEAD_IN_S = 0.8;
const HOLD_S = 1.4;

/**
 * Replays a real recorded loop at chain speed: the swap lands, Lasna reacts, and the exit lands as many Unichain
 * seconds later as it did on-chain (from the swap and exit blocks' own timestamps). Nothing is invented: the replay
 * only withholds each recorded hop until its moment. Lasna's clock skews against Unichain's, so the reaction is staged
 * between the two Unichain hops, and the page says so while it plays.
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

type Tone = "yellow" | "amber" | "green" | "red";

function Stop({ k, chain, block, lit, tone, children }: { k: string; chain: string; block?: bigint; lit: boolean; tone: Tone; children: React.ReactNode }) {
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

/**
 * Length equals duration: one cell per real Unichain block from the crossing swap, labelled with its own number.
 * The swap's cell is yellow; each block after it, up to the exit, lights green (red when the exit was refused).
 */
function Ruler({ from, lit, end, refused }: { from?: bigint; lit?: number; end?: number; refused: boolean }) {
  return (
    <div className="ruler" aria-hidden="true">
      {Array.from({ length: SCALE_BLOCKS }, (_, i) => {
        const cls = ["cell"];
        if (from !== undefined && lit !== undefined && i === 0) cls.push("swap");
        if (lit !== undefined && i > 0 && i <= lit) cls.push(refused ? "off" : "on");
        const mark = from !== undefined && lit !== undefined ? (i === 0 ? "Swap" : i === end && i <= lit ? (refused ? "Refused" : "Exit") : "") : "";
        return (
          <span className={cls.join(" ")} key={i}>
            <span className="cell-mark">{mark}</span>
            <i />
            <span className="cell-no num">{from !== undefined ? String(from + BigInt(i)).slice(-3) : ""}</span>
          </span>
        );
      })}
    </div>
  );
}

const countText = (n: number | undefined) => (n === undefined ? "        " : `${n} ${n === 1 ? "BLOCK " : "BLOCKS"}`);

export function Departure({ p, tickNow }: { p?: Position; tickNow?: number }) {
  const { shown, playing, canReplay, play, counting } = useReplay(p);
  if (!shown || !p) {
    return (
      <section className="departure loading" id="departure" aria-label="Featured departure">
        <p className="dep-empty">Reading the latest departure from Unichain Sepolia and Lasna…</p>
      </section>
    );
  }
  const status = boardStatus(shown);
  const blocks = blocksToExit(p);
  const secs = secondsToExit(p);
  const live = status === "armed" && !playing;
  const tickLabel = live ? "Pool tick now" : "Swap tick";
  const tickValue = live ? tickNow : shown.swap?.tick;
  const room = live && tickNow !== undefined ? headroom(shown.line, shown.exitBelow, tickNow) : undefined;
  const counted = counting ?? (shown.exit || shown.failure ? blocks : undefined);
  const failure = shown.failure;
  const end = p.exit?.block ?? p.failure?.block;

  let note: string;
  if (playing) {
    note = `Replaying the recorded loop: the swap and the exit land at their recorded Unichain seconds. Lasna's reaction, its own block #${p.lasna ? fmtInt(p.lasna.block) : "?"}, is staged between them.`;
  } else if (p.swap && end !== undefined && blocks !== undefined) {
    const beyond = blocks >= SCALE_BLOCKS ? `, past this ${SCALE_BLOCKS}-block scale` : "";
    note = `Unichain #${fmtInt(p.swap.block)} → #${fmtInt(end)}${secs !== undefined ? `, ${secs} s on Unichain's clock` : ""}${beyond}. Scale: ${SCALE_BLOCKS} Unichain blocks from the swap.`;
  } else if (shown.lasna) {
    note = "Lasna has pulled the ripcord; the exit lands on Unichain next.";
  } else {
    note = `Scale: ${SCALE_BLOCKS} Unichain blocks. It fills from the swap that crosses the line.`;
  }

  return (
    <section className="departure" id="departure" aria-label={`Departure of position ${shown.tokenId}`}>
      <div className="dep-row dep-readouts">
        <div>
          <p className="dep-label">Position</p>
          <h2 className="dep-title" tabIndex={-1}>
            <span className="sr-only">Position </span>
            <Flap text={`#${shown.tokenId}`} size="l" />
          </h2>
        </div>
        <div>
          <p className="dep-label">{tickLabel}</p>
          <Flap text={tickValue !== undefined ? fmtTick(tickValue) : "    "} tone={tickValue !== undefined ? "ink" : "dim"} size="l" />
        </div>
        <div>
          <p className="dep-label">Line · exit {shown.exitBelow ? "at or below" : "at or above"}</p>
          <Flap text={`${shown.exitBelow ? "≤" : "≥"}${fmtTick(shown.line)}`} tone="yellow" size="l" />
        </div>
      </div>

      <div className="dep-row dep-status">
        <Flap text={statusWord[status]} tone={statusTone[status]} size="xl" />
      </div>

      <ol className="dep-row route" aria-label="Calling at">
        <Stop k="Swap" chain="Unichain Sepolia" block={shown.swap?.block} lit={!!shown.swap} tone="yellow">
          {shown.swap ? (
            <>
              <span className="stop-line">
                tick → {fmtTick(shown.swap.tick ?? 0)}, <strong className="crossed">crosses {fmtTick(shown.line)}</strong>
              </span>
              <a className="hash" href={txUrl("unichain", shown.swap.tx)} target="_blank" rel="noreferrer">
                {shortHash(shown.swap.tx)}
              </a>
            </>
          ) : room !== undefined ? (
            <span className="stop-line">
              Waiting · {fmtInt(Math.abs(room))} ticks {room >= 0 ? "of headroom" : "past the line"}
            </span>
          ) : (
            <span className="stop-line">Waiting for a swap to cross the line</span>
          )}
        </Stop>
        <Stop k="React" chain="Reactive Lasna" block={shown.lasna?.block} lit={!!shown.lasna} tone="amber">
          {shown.lasna ? (
            <>
              <span className="stop-line">ripcord pulled</span>
              <a className="hash" href={txUrl("lasna", shown.lasna.tx)} target="_blank" rel="noreferrer">
                {shortHash(shown.lasna.tx)}
              </a>
            </>
          ) : (
            <span className="stop-line">RipcordReactive</span>
          )}
        </Stop>
        <Stop k={failure ? "Refused" : "Exit"} chain="Unichain Sepolia" block={shown.exit?.block ?? failure?.block} lit={!!(shown.exit || failure)} tone={failure ? "red" : "green"}>
          {shown.exit ? (
            <>
              <span className="stop-line">all liquidity to the owner</span>
              <span className="stop-line num">
                {fmtAmount(shown.exit.amount0)} RDA · {fmtAmount(shown.exit.amount1)} RDB
              </span>
              <a className="hash" href={txUrl("unichain", shown.exit.tx)} target="_blank" rel="noreferrer">
                {shortHash(shown.exit.tx)}
              </a>
            </>
          ) : failure ? (
            <>
              <span className="stop-line">{failure.reason}</span>
              <a className="hash" href={txUrl("unichain", failure.tx)} target="_blank" rel="noreferrer">
                {shortHash(failure.tx)}
              </a>
            </>
          ) : (
            <span className="stop-line">RipcordVault</span>
          )}
        </Stop>
      </ol>

      <div className="dep-row dep-count">
        <div className="count-head">
          <div>
            <p className="dep-label">Swap to exit</p>
            <Flap text={countText(counted)} tone={counted === undefined ? "dim" : failure ? "red" : "green"} size="xl" />
          </div>
          {canReplay && (
            <button type="button" className="replay" onClick={play} disabled={playing} aria-describedby="dep-note">
              <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true" focusable="false">
                {playing ? <rect x="3" y="3" width="8" height="8" /> : <path d="M4 2.5v9l7.5-4.5z" />}
              </svg>
              {playing ? "Replaying at chain speed" : "Replay this departure"}
            </button>
          )}
        </div>
        <Ruler from={p.swap?.block} lit={counted} end={blocks} refused={!!p.failure && !p.exit} />
        <p className="dep-note" id="dep-note">
          {note}
        </p>
      </div>
      <p className="sr-only" aria-live="polite">
        {playing ? `Replaying position ${shown.tokenId} at chain speed.` : ""}
      </p>
    </section>
  );
}

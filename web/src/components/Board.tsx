import { useState } from "react";
import { addressUrl, deploy, txUrl } from "../chain/clients";
import type { Funding, Tank } from "../chain/funding";
import {
  blocksToExit,
  boardStatus,
  eventTime,
  fmtInt,
  fmtTick,
  fmtUtc,
  shortHash,
  sortPositions,
  statusTone,
  statusWord,
  type BoardStatus,
  type Position,
  type SortKey,
} from "../chain/model";
import { fundingState, type FundingState } from "../chain/useFunding";
import { Flap } from "./Flap";
import { SortMark } from "./SortMark";

const columns: { key?: SortKey; label: string; cls: string }[] = [
  { key: "time", label: "Time UTC", cls: "c-time" },
  { key: "position", label: "Position", cls: "c-pos" },
  { label: "Line", cls: "c-line" },
  { label: "Swap tick", cls: "c-swap" },
  { key: "status", label: "Status", cls: "c-status" },
  { key: "blocks", label: "Swap → exit", cls: "c-blocks" },
  { label: "Exit tx", cls: "c-tx" },
];

const order: BoardStatus[] = ["armed", "boarding", "departed", "cancelled", "disarmed"];
const chipWord: Record<BoardStatus, string> = {
  armed: "Armed",
  boarding: "Boarding",
  departed: "Departed",
  cancelled: "Cancelled",
  disarmed: "Disarmed",
};

const stateWord: Record<FundingState, string> = { "in-service": "In service", low: "Low", unfunded: "Unfunded" };
const stateTone: Record<FundingState, "green" | "amber" | "red"> = { "in-service": "green", low: "amber", unfunded: "red" };

const day = (seconds: number) => new Date(seconds * 1000).toLocaleDateString("en-GB", { day: "2-digit", month: "short", timeZone: "UTC" });

/** Ether-style amounts with enough decimals to see a balance move by one exit. */
function fmtBalance(wei: bigint): string {
  const n = Number(wei) / 1e18;
  if (n === 0) return "0";
  const digits = Math.max(3, Math.ceil(-Math.log10(n)) + 2);
  return n.toFixed(Math.min(digits, 9));
}

function TankCell({ label, unit, chain, address, tank }: { label: string; unit: string; chain: "unichain" | "lasna"; address: string; tank?: Tank }) {
  const state = fundingState(tank?.covers);
  const tone = state ? stateTone[state] : "dim";
  return (
    <div className="svc-cell">
      <p className="svc-label">
        {label} · <span className="ticker">{unit}</span>
      </p>
      <Flap text={tank?.covers !== undefined ? `${fmtInt(tank.covers)} ${tank.covers === 1 ? "EXIT" : "EXITS"}` : "        "} tone={tone} size="s" />
      <p className="svc-sub">
        {state && <span className={`svc-state tone-${tone}`}>{stateWord[state]}</span>}
        {tank ? (
          <a className="num" href={addressUrl(chain, address)} target="_blank" rel="noreferrer">
            {fmtBalance(tank.balance)} <span className="ticker">{unit}</span>
          </a>
        ) : (
          <span>Reading balance…</span>
        )}
      </p>
    </div>
  );
}

export function Board({
  positions,
  selected,
  onSelect,
  loading,
  poolTick,
  funding,
}: {
  positions: Position[];
  selected?: bigint;
  onSelect: (id: bigint) => void;
  loading: boolean;
  poolTick?: number;
  funding?: Funding;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "time", dir: -1 });
  const [only, setOnly] = useState<BoardStatus | undefined>(undefined);
  const counts = new Map<BoardStatus, number>();
  for (const p of positions) counts.set(boardStatus(p), (counts.get(boardStatus(p)) ?? 0) + 1);
  // Armed always shows, so a judge can see there is nothing waiting; other states appear once something holds them.
  const chips = order.filter((k) => k === "armed" || (counts.get(k) ?? 0) > 0);
  const filter = only && chips.includes(only) ? only : undefined;
  const rows = sortPositions(filter ? positions.filter((p) => boardStatus(p) === filter) : positions, sort.key, sort.dir);
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "position" ? -1 : 1 }));
  const unfunded = fundingState(funding?.reactive.covers) === "unfunded" || fundingState(funding?.vault.covers) === "unfunded";

  return (
    <section className="board-section" id="board" aria-labelledby="board-title">
      <header className="board-head">
        <div className="board-title">
          <h2 id="board-title">Departures</h2>
          <p className="board-sub">Demo pool RDA/RDB on Unichain Sepolia · every row read from chain</p>
        </div>
        <div className="svc" role="group" aria-label="Service">
          <div className="svc-cell">
            <p className="svc-label">Pool tick now</p>
            <Flap text={poolTick !== undefined ? fmtTick(poolTick) : "    "} tone={poolTick !== undefined ? "ink" : "dim"} size="s" />
            <p className="svc-sub">turns on every swap in the pool</p>
          </div>
          <TankCell label="RipcordReactive" unit="lREACT" chain="lasna" address={deploy.ripcordReactive} tank={funding?.reactive} />
          <TankCell label="RipcordVault" unit="ETH" chain="unichain" address={deploy.ripcordVault} tank={funding?.vault} />
        </div>
        <div className="board-tools">
          <div className="chips" role="group" aria-label="Show departures by status">
            <button type="button" className="chip" aria-pressed={filter === undefined} onClick={() => setOnly(undefined)}>
              All <span className="num">{positions.length}</span>
            </button>
            {chips.map((k) => (
              <button key={k} type="button" className={`chip chip-${statusTone[k]}`} aria-pressed={filter === k} onClick={() => setOnly(filter === k ? undefined : k)}>
                {chipWord[k]} <span className="num">{counts.get(k) ?? 0}</span>
              </button>
            ))}
          </div>
          <p className="svc-note">
            Exits each balance covers at the cost of the last loop{funding?.basis !== undefined ? ` (#${funding.basis})` : ""}. While a line is armed, every
            swap in its pool also bills a reaction.
          </p>
        </div>
      </header>
      <div className="board-wrap" role="region" aria-labelledby="board-title" tabIndex={0}>
        <table className="board">
          <caption className="sr-only">Departures{filter ? `, showing ${chipWord[filter].toLowerCase()} only` : ""}</caption>
          <thead>
            <tr>
              {columns.map((c) => {
                const active = c.key && sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined;
                return (
                  <th key={c.label} scope="col" className={c.cls} aria-sort={active}>
                    {c.key ? (
                      <button type="button" className="sort" onClick={() => toggle(c.key!)}>
                        {c.label}
                        <SortMark dir={active} />
                      </button>
                    ) : (
                      c.label
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr className="empty">
                <td colSpan={columns.length}>
                  {loading
                    ? "Reading the board from Unichain Sepolia and Lasna…"
                    : filter
                      ? `No ${chipWord[filter].toLowerCase()} departures right now.`
                      : "No departures scheduled. The next demo run arms a line here."}
                </td>
              </tr>
            )}
            {rows.map((p) => {
              const status = boardStatus(p);
              const blocks = blocksToExit(p);
              const isSel = p.tokenId === selected;
              const t = eventTime(p);
              const tx = p.exit?.tx ?? p.failure?.tx;
              return (
                <tr key={String(p.tokenId)} className={isSel ? "sel" : undefined} onClick={() => onSelect(p.tokenId)}>
                  <td className="c-time">
                    <Flap text={t ? fmtUtc(t) : "        "} tone={t ? "ink" : "dim"} size="s" />
                    {t ? <span className="day">{day(t)}</span> : null}
                  </td>
                  <th scope="row" className="c-pos">
                    <button type="button" className="pos" aria-pressed={isSel} onClick={(e) => (e.stopPropagation(), onSelect(p.tokenId))}>
                      <Flap text={`#${p.tokenId}`} tone="ink" size="s" />
                    </button>
                  </th>
                  <td className="c-line">
                    <span className="phone-only" aria-hidden="true">
                      Line
                    </span>
                    <span className="sr-only">exit {p.exitBelow ? "at or below" : "at or above"} </span>
                    <Flap text={`${p.exitBelow ? "≤" : "≥"}${fmtTick(p.line)}`} tone="ink" size="s" />
                  </td>
                  <td className="c-swap">
                    <span className="phone-only" aria-hidden="true">
                      Swap
                    </span>
                    {p.swap?.tick !== undefined ? <Flap text={fmtTick(p.swap.tick)} tone="ink" size="s" /> : <span className="none">—</span>}
                  </td>
                  <td className="c-status">
                    <Flap text={statusWord[status]} tone={statusTone[status]} size="s" />
                    {status === "armed" && p.approvalOk === false && <span className="warn">Vault approval missing: this exit will fail</span>}
                    {status === "armed" && unfunded && <span className="warn">Unfunded: this exit can't be paid for</span>}
                  </td>
                  <td className="c-blocks">
                    {blocks !== undefined ? (
                      <Flap text={`${blocks} ${blocks === 1 ? "BLOCK " : "BLOCKS"}`} tone={p.exit ? "green" : "red"} size="s" />
                    ) : (
                      <span className="none">—</span>
                    )}
                  </td>
                  <td className="c-tx">
                    {tx ? (
                      <a className="hash" href={txUrl("unichain", tx)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                        {shortHash(tx)}
                      </a>
                    ) : (
                      <span className="none">—</span>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </section>
  );
}

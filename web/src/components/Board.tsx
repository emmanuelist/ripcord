import { useState } from "react";
import { txUrl } from "../chain/clients";
import {
  blocksToExit,
  boardStatus,
  eventTime,
  fmtTick,
  fmtUtc,
  shortHash,
  sortPositions,
  statusTone,
  statusWord,
  type Position,
  type SortKey,
} from "../chain/model";
import { Flap } from "./Flap";
import { SortMark } from "./SortMark";

const columns: { key?: SortKey; label: string; cls: string }[] = [
  { key: "time", label: "Time UTC", cls: "c-time" },
  { key: "position", label: "Position", cls: "c-pos" },
  { label: "Line", cls: "c-line" },
  { label: "Exit if", cls: "c-dir" },
  { label: "Swap tick", cls: "c-swap" },
  { key: "status", label: "Status", cls: "c-status" },
  { key: "blocks", label: "Swap → exit", cls: "c-blocks" },
  { label: "Exit tx", cls: "c-tx" },
];

export function Board({
  positions,
  selected,
  onSelect,
  loading,
}: {
  positions: Position[];
  selected?: bigint;
  onSelect: (id: bigint) => void;
  loading: boolean;
}) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: "time", dir: -1 });
  const rows = sortPositions(positions, sort.key, sort.dir);
  const toggle = (key: SortKey) => setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: key === "position" ? -1 : 1 }));

  return (
    <div className="board-wrap" role="region" aria-labelledby="board-caption" tabIndex={0}>
      <table className="board">
        <caption id="board-caption">
          <span className="caption-title">Departures</span>
          <span className="caption-sub">Demo pool RDA/RDB on Unichain Sepolia · every row read from chain</span>
        </caption>
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
              <td colSpan={columns.length}>{loading ? "Reading the board from Unichain Sepolia and Lasna…" : "No departures scheduled. The next demo run arms a line here."}</td>
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
                </td>
                <th scope="row" className="c-pos">
                  <button type="button" className="pos" aria-pressed={isSel} onClick={(e) => (e.stopPropagation(), onSelect(p.tokenId))}>
                    <Flap text={`#${p.tokenId}`} tone="ink" size="s" />
                  </button>
                </th>
                <td className="c-line num">
                  <span className="phone-only">line {p.exitBelow ? "≤" : "≥"} </span>
                  {fmtTick(p.line)}
                  {p.swap?.tick !== undefined && <span className="phone-only"> → {fmtTick(p.swap.tick)}</span>}
                </td>
                <td className="c-dir">{p.exitBelow ? "at or below" : "at or above"}</td>
                <td className="c-swap num">
                  {p.swap?.tick !== undefined ? fmtTick(p.swap.tick) : "—"}
                </td>
                <td className="c-status">
                  <Flap text={statusWord[status]} tone={statusTone[status]} size="s" />
                  {status === "armed" && p.approvalOk === false && <span className="warn">Vault approval missing: this exit will fail</span>}
                </td>
                <td className="c-blocks num">{blocks !== undefined ? `${blocks} ${blocks === 1 ? "block" : "blocks"}` : "—"}</td>
                <td className="c-tx">
                  {tx ? (
                    <a className="hash" href={txUrl("unichain", tx)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      {shortHash(tx)}
                    </a>
                  ) : (
                    "—"
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

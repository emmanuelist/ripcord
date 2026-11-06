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

const columns: { key?: SortKey; label: string }[] = [
  { key: "time", label: "Time UTC" },
  { key: "position", label: "Position" },
  { label: "Line" },
  { label: "Exit if" },
  { label: "Swap tick" },
  { key: "status", label: "Status" },
  { key: "blocks", label: "Swap → exit" },
  { label: "Exit tx" },
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
            {columns.map((c) => (
              <th
                key={c.label}
                scope="col"
                aria-sort={c.key && sort.key === c.key ? (sort.dir === 1 ? "ascending" : "descending") : undefined}
              >
                {c.key ? (
                  <button type="button" className="sort" onClick={() => toggle(c.key!)}>
                    {c.label}
                    <span className="sort-mark" aria-hidden="true">
                      {sort.key === c.key ? (sort.dir === 1 ? "↑" : "↓") : "↕"}
                    </span>
                  </button>
                ) : (
                  c.label
                )}
              </th>
            ))}
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
            const done = status === "departed" || status === "disarmed";
            return (
              <tr key={String(p.tokenId)} className={`${isSel ? "sel" : ""}${done ? " done" : ""}`} onClick={() => onSelect(p.tokenId)}>
                <td data-label="Time UTC" className="num">{fmtUtc(eventTime(p) || undefined)}</td>
                <th scope="row" data-label="Position">
                  <button type="button" className="pos" aria-pressed={isSel} onClick={(e) => (e.stopPropagation(), onSelect(p.tokenId))}>
                    #{String(p.tokenId)}
                  </button>
                </th>
                <td data-label="Line" className="num">{fmtTick(p.line)}</td>
                <td data-label="Exit if">{p.exitBelow ? "at or below" : "at or above"}</td>
                <td data-label="Swap tick" className="num">{p.swap?.tick !== undefined ? fmtTick(p.swap.tick) : "—"}</td>
                <td data-label="Status" className="status">
                  <Flap text={statusWord[status]} tone={statusTone[status]} size="s" />
                  {status === "armed" && p.approvalOk === false && <span className="warn">Vault approval missing: this exit will fail</span>}
                </td>
                <td data-label="Swap → exit" className="num">{blocks !== undefined ? `${blocks} ${blocks === 1 ? "block" : "blocks"}` : "—"}</td>
                <td data-label="Exit tx">
                  {p.exit ? (
                    <a className="hash" href={txUrl("unichain", p.exit.tx)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      {shortHash(p.exit.tx)}
                    </a>
                  ) : p.failure ? (
                    <a className="hash" href={txUrl("unichain", p.failure.tx)} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()}>
                      {shortHash(p.failure.tx)}
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

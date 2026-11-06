import { txUrl } from "../chain/clients";
import {
  blocksToExit,
  boardStatus,
  fmtAmount,
  fmtInt,
  fmtTick,
  fmtUtc,
  headroom,
  secondsToExit,
  shortHash,
  type Position,
} from "../chain/model";

/** One fixed whole-block scale for every loop, so runs compare at a glance. */
const SCALE_BLOCKS = 8;

function HopLink({ chain, tx }: { chain: "unichain" | "lasna"; tx: string }) {
  return (
    <a className="hash" href={txUrl(chain, tx)} target="_blank" rel="noreferrer">
      {shortHash(tx)}
    </a>
  );
}

export function Rail({ p, tickNow }: { p?: Position; tickNow?: number }) {
  if (!p) {
    return (
      <aside className="rail" id="rail" aria-label="Selected position">
        <h2 className="rail-title" tabIndex={-1}>Select a position</h2>
        <p className="rail-note">Pick a row on the board to see its swap, the Lasna reaction, and the exit.</p>
      </aside>
    );
  }
  const status = boardStatus(p);
  const blocks = blocksToExit(p);
  const secs = secondsToExit(p);
  const room = tickNow !== undefined ? headroom(p.line, p.exitBelow, tickNow) : undefined;

  return (
    <aside className="rail" id="rail" aria-label={`Position ${p.tokenId}`}>
      <h2 className="rail-title" tabIndex={-1}>Position #{String(p.tokenId)}</h2>
      <p className="rail-line">
        Line {fmtTick(p.line)}, exit {p.exitBelow ? "at or below" : "at or above"}
      </p>

      {status === "armed" && (
        <div className="rail-armed">
          {room !== undefined && (
            <p>
              <strong className="num">{fmtInt(Math.abs(room))}</strong> ticks {room >= 0 ? "of headroom before the line" : "past the line, waiting for the next swap"}
            </p>
          )}
          <p className={p.approvalOk === false ? "warn" : "rail-note"}>
            {p.approvalOk === false
              ? "The vault is not approved on this position any more. When the line is crossed, the exit will fail and show as cancelled."
              : "Armed. The first swap that crosses the line pulls this position out of the pool."}
          </p>
        </div>
      )}

      <ol className="hops">
        <li className={p.swap ? "on" : ""}>
          <span className="hop-k">Swap</span>
          <span className="hop-v">
            {p.swap ? (
              <>
                Unichain #{fmtInt(p.swap.block)}
                {p.swap.tick !== undefined && (
                  <>
                    {" "}· tick → {fmtTick(p.swap.tick)}, <strong className="crossed">crosses line {fmtTick(p.line)}</strong>
                  </>
                )}{" "}
                · <HopLink chain="unichain" tx={p.swap.tx} />
              </>
            ) : (
              "Waiting for a swap to cross the line"
            )}
          </span>
        </li>
        <li className={p.lasna ? "on" : ""}>
          <span className="hop-k">React</span>
          <span className="hop-v">
            {p.lasna ? (
              <>
                Lasna #{fmtInt(p.lasna.block)} · ripcord pulled · <HopLink chain="lasna" tx={p.lasna.tx} />
              </>
            ) : (
              "RipcordReactive on Lasna"
            )}
          </span>
        </li>
        <li className={p.exit || p.failure ? "on" : ""}>
          <span className="hop-k">{p.failure ? "Failed" : "Exit"}</span>
          <span className="hop-v">
            {p.exit ? (
              <>
                Unichain #{fmtInt(p.exit.block)} · all liquidity to the owner · <HopLink chain="unichain" tx={p.exit.tx} />
              </>
            ) : p.failure ? (
              <>
                Unichain #{fmtInt(p.failure.block)} · {p.failure.reason} <HopLink chain="unichain" tx={p.failure.tx} />
              </>
            ) : (
              "RipcordVault removes the liquidity"
            )}
          </span>
        </li>
      </ol>

      {blocks !== undefined && (
        <figure className="scale" aria-label={`${blocks} Unichain blocks from the crossing swap to the exit`}>
          <div className="scale-cells" aria-hidden="true">
            {Array.from({ length: SCALE_BLOCKS }, (_, i) => (
              <i key={i} className={i < blocks ? "on" : ""} />
            ))}
          </div>
          <figcaption>
            <span>
              <strong className="num">{blocks}</strong> Unichain {blocks === 1 ? "block" : "blocks"} swap → exit
              {secs !== undefined && <>, {secs} s on Unichain's clock</>}
            </span>
            <span className="scale-end">{SCALE_BLOCKS} blocks</span>
          </figcaption>
        </figure>
      )}

      {p.exit && (
        <dl className="returned">
          <div>
            <dt>Returned RDA</dt>
            <dd className="num">{fmtAmount(p.exit.amount0)}</dd>
          </div>
          <div>
            <dt>Returned RDB</dt>
            <dd className="num">{fmtAmount(p.exit.amount1)}</dd>
          </div>
          <div>
            <dt>Exited, UTC</dt>
            <dd className="num">{fmtUtc(p.exit.time)}</dd>
          </div>
        </dl>
      )}

      <p className="rail-note">
        Block counts come from the chain. A browser reading public RPCs sees each hop a little later than it was included.
      </p>
    </aside>
  );
}

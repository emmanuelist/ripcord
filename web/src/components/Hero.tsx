import { blocksToExit, secondsToExit, type Position } from "../chain/model";

const span = (xs: number[]) => {
  if (!xs.length) return undefined;
  const lo = Math.min(...xs);
  const hi = Math.max(...xs);
  return lo === hi ? `${lo}` : `${lo}–${hi}`;
};

/** The claim at display scale, then one evidence sentence computed live from the board's own exits. */
export function Hero({ positions }: { positions: Position[] }) {
  const exited = positions.filter((p) => p.exit);
  const blocks = span(exited.map(blocksToExit).filter((b): b is number => b !== undefined));
  const secs = span(exited.map(secondsToExit).filter((b): b is number => b !== undefined));

  return (
    <div className="hero-copy">
      <h1 className="hero-title">
        Your Uniswap v4 position leaves the pool seconds after a swap <em>crosses your line</em>.
      </h1>
      <p className="hero-sub">
        A Reactive contract on Lasna watches the pool and pulls your liquidity out, with nothing of yours running.
      </p>
      <p className="hero-proof" aria-live="off">
        {blocks !== undefined ? (
          <>
            Across all <strong className="num">{exited.length}</strong> {exited.length === 1 ? "exit" : "exits"} on this board, swap to exit took{" "}
            <strong className="num">{blocks} Unichain blocks</strong>
            {secs !== undefined && <> ({secs} s on Unichain's clock)</>}.
          </>
        ) : (
          <>Reading every recorded exit from Unichain Sepolia…</>
        )}
      </p>
      <p className="hero-links">
        <a href="#board">
          See every departure
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true" focusable="false">
            <path d="M6 1.5v9M2.5 7 6 10.5 9.5 7" />
          </svg>
        </a>
        <a href="#how">How a ripcord pulls</a>
      </p>
    </div>
  );
}

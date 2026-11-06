import { useEffect, useMemo, useState } from "react";
import { useRipcord } from "./chain/useRipcord";
import { eventTime } from "./chain/model";
import { Board } from "./components/Board";
import { Explainer } from "./components/Explainer";
import { LeadStrip } from "./components/LeadStrip";
import { Rail } from "./components/Rail";
import { Shell } from "./components/Shell";

function initialSelection(): bigint | undefined {
  const q = new URLSearchParams(window.location.search).get("position");
  return q && /^\d+$/.test(q) ? BigInt(q) : undefined;
}

export function App() {
  const s = useRipcord();
  const [picked, setPicked] = useState<bigint | undefined>(initialSelection);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const positions = useMemo(() => [...s.positions.values()], [s.positions]);
  // With nothing picked, follow the newest event, so a live run takes the rail as it happens.
  const latest = useMemo(() => [...positions].sort((a, b) => eventTime(b) - eventTime(a))[0], [positions]);
  const selectedId = picked !== undefined && s.positions.has(picked) ? picked : latest?.tokenId;
  const selected = selectedId !== undefined ? s.positions.get(selectedId) : undefined;

  const select = (id: bigint) => {
    setPicked(id);
    const url = new URL(window.location.href);
    url.searchParams.set("position", String(id));
    window.history.replaceState(null, "", url);
  };

  return (
    <>
      <a className="skip" href="#console">
        Skip to the board
      </a>
      <Shell uniHead={s.uniHead} lasnaHead={s.lasnaHead} updatedAt={s.updatedAt} error={s.error} now={now} />
      <main id="top">
        <h1 className="sr-only">Ripcord: Uniswap v4 positions that leave the pool when a swap crosses their line</h1>
        <div className="console" id="console">
          <div className="console-main">
            <LeadStrip positions={positions} tickNow={s.poolTick} />
            <Board positions={positions} selected={selectedId} onSelect={select} loading={s.loading} />
          </div>
          <Rail p={selected} tickNow={s.poolTick} />
        </div>
        <Explainer />
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {s.announcement}
      </div>
    </>
  );
}

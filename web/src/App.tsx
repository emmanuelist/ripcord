import { useEffect, useMemo, useState } from "react";
import { useRipcord } from "./chain/useRipcord";
import { eventTime } from "./chain/model";
import { Board } from "./components/Board";
import { Departure } from "./components/Departure";
import { Explainer } from "./components/Explainer";
import { Hero } from "./components/Hero";
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
  // With nothing picked, follow the newest event, so a live run takes the featured departure as it happens.
  const latest = useMemo(() => [...positions].sort((a, b) => eventTime(b) - eventTime(a))[0], [positions]);
  const selectedId = picked !== undefined && s.positions.has(picked) ? picked : latest?.tokenId;
  const selected = selectedId !== undefined ? s.positions.get(selectedId) : undefined;
  // The explainer quotes one real loop's hops: the featured one if it exited, else the newest exit.
  const quoted = selected?.exit ? selected : positions.filter((p) => p.exit).sort((a, b) => eventTime(b) - eventTime(a))[0];

  const select = (id: bigint) => {
    setPicked(id);
    const url = new URL(window.location.href);
    url.searchParams.set("position", String(id));
    window.history.replaceState(null, "", url);
    // The featured departure sits above the board: bring it into view so choosing a row visibly does something.
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    requestAnimationFrame(() => {
      const panel = document.getElementById("departure");
      if (!panel) return;
      const r = panel.getBoundingClientRect();
      if (r.top < 64 || r.bottom > window.innerHeight) panel.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
      panel.querySelector<HTMLElement>(".dep-title")?.focus({ preventScroll: true });
    });
  };

  return (
    <>
      <a className="skip" href="#board">
        Skip to the departures
      </a>
      <Shell uniHead={s.uniHead} lasnaHead={s.lasnaHead} updatedAt={s.updatedAt} error={s.error} now={now} />
      <main id="top">
        <section className="hero" aria-label="Ripcord">
          <Hero positions={positions} />
          <Departure key={selected ? String(selected.tokenId) : "none"} p={selected} tickNow={s.poolTick} />
        </section>
        <Board positions={positions} selected={selectedId} onSelect={select} loading={s.loading} />
        <Explainer p={quoted} />
      </main>
      <div className="sr-only" aria-live="polite" aria-atomic="true">
        {s.announcement}
      </div>
    </>
  );
}

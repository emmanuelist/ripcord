import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { flapSteps } from "./flapSteps";

const reducedQuery = typeof window !== "undefined" ? window.matchMedia("(prefers-reduced-motion: reduce)") : undefined;
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      reducedQuery?.addEventListener("change", cb);
      return () => reducedQuery?.removeEventListener("change", cb);
    },
    () => reducedQuery?.matches ?? false,
    () => false,
  );
}

/** Barlow Semi Condensed has no ≤ or ≥ (checked in the browser), so those two are drawn in the flap's own ink and weight. */
function Glyph({ ch }: { ch: string }) {
  if (ch === "≤" || ch === "≥") {
    const chevron = ch === "≤" ? "M7.6 2.8 2.6 6.4l5 3.6" : "M2.6 2.8l5 3.6-5 3.6";
    return (
      <svg className="dir" viewBox="0 0 10.2 16" aria-hidden="true" focusable="false">
        <path d={chevron} />
        <path d="M2.6 13h5" />
      </svg>
    );
  }
  return <>{ch === " " ? "\u00a0" : ch}</>;
}

/** One flap step: the upper half falls (half of it), then the lower half lands (the other half). Matches the CSS. */
const STEP_MS = 130;
const STAGGER_MS = 40;

interface Turning {
  chars: string[];
  /** The character each tile showed before its latest step: its halves are the ones that fall away. */
  prev: string[];
  /** Per tile, how many times it has turned; keys the remount that plays one fall. */
  turns: number[];
}

/**
 * A row of split-flap tiles. The characters turn only when `text` changes (a real state change), never on first
 * render, and never under reduced motion. Each step is a real flap fall: the old upper half hinges down over the
 * split, revealing the new upper half, then the new lower half swings down onto the old one. Screen readers get the
 * final text, not the flapping.
 */
export function Flap({
  text,
  tone = "ink",
  size = "m",
  className,
}: {
  text: string;
  tone?: "ink" | "yellow" | "amber" | "green" | "red" | "dim";
  size?: "s" | "m" | "l" | "xl";
  className?: string;
}) {
  const reduced = usePrefersReducedMotion();
  const [turning, setTurning] = useState<Turning>(() => ({ chars: [...text], prev: [...text], turns: [...text].map(() => 0) }));
  const settled = useRef(text);

  useEffect(() => {
    if (reduced || settled.current === text) return;
    const from = [...settled.current];
    const to = [...text];
    settled.current = text;
    const width = Math.max(from.length, to.length);
    const timers: ReturnType<typeof setTimeout>[] = [];
    let lastAt = 0;
    for (let i = 0; i < width; i++) {
      const seq = flapSteps(from[i] ?? " ", to[i] ?? " ");
      seq.forEach((ch, k) => {
        const at = i * STAGGER_MS + k * STEP_MS;
        lastAt = Math.max(lastAt, at);
        timers.push(
          setTimeout(() => {
            setTurning((t) => {
              const chars = [...t.chars];
              const prev = [...t.prev];
              const turns = [...t.turns];
              while (chars.length < width) {
                chars.push(" ");
                prev.push(" ");
                turns.push(0);
              }
              prev[i] = chars[i] ?? " ";
              chars[i] = ch;
              turns[i] = (turns[i] ?? 0) + 1;
              return { chars, prev, turns };
            });
          }, at),
        );
      });
    }
    // Settle exactly on the new text once the slowest tile has landed (trims tiles a shorter word no longer needs).
    timers.push(
      setTimeout(
        () => setTurning((t) => ({ chars: [...text], prev: [...text], turns: t.turns.slice(0, to.length) })),
        lastAt + STEP_MS + 40,
      ),
    );
    return () => timers.forEach(clearTimeout);
  }, [text, reduced]);

  const chars = reduced ? [...text] : turning.chars;
  return (
    <span className={`flap flap-${size} tone-${tone}${className ? ` ${className}` : ""}`}>
      <span className="sr-only">{text}</span>
      <span className="flap-tiles" aria-hidden="true">
        {chars.map((ch, i) => {
          const turns = reduced ? 0 : (turning.turns[i] ?? 0);
          const old = turning.prev[i] ?? " ";
          const falling = turns > 0 && old !== ch;
          return (
            <span className={`tile${ch === " " ? " blank" : ""}`} key={i}>
              <span className="glyph">
                <Glyph ch={ch} />
              </span>
              {falling && (
                <span className="fall" key={turns}>
                  <span className="half old-bottom">
                    <Glyph ch={old} />
                  </span>
                  <span className="half old-top">
                    <Glyph ch={old} />
                  </span>
                  <span className="half new-bottom">
                    <Glyph ch={ch} />
                  </span>
                </span>
              )}
            </span>
          );
        })}
      </span>
    </span>
  );
}

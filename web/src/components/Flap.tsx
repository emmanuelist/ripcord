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

const STEP_MS = 55;
const STAGGER_MS = 32;

interface Turning {
  chars: string[];
  /** Per tile, how many times it has turned; drives the remount that plays one flip. */
  turns: number[];
}

/**
 * A row of split-flap tiles. The characters turn only when `text` changes (a real state change), never on first
 * render, and never under reduced motion. Screen readers get the final text, not the flapping.
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
  const [turning, setTurning] = useState<Turning>(() => ({ chars: [...text], turns: [...text].map(() => 0) }));
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
              const turns = [...t.turns];
              while (chars.length < width) {
                chars.push(" ");
                turns.push(0);
              }
              chars[i] = ch;
              turns[i] = (turns[i] ?? 0) + 1;
              return { chars, turns };
            });
          }, at),
        );
      });
    }
    // Settle exactly on the new text once the slowest tile has landed (trims tiles a shorter word no longer needs).
    timers.push(
      setTimeout(() => setTurning((t) => ({ chars: [...text], turns: t.turns.slice(0, to.length) })), lastAt + STEP_MS),
    );
    return () => timers.forEach(clearTimeout);
  }, [text, reduced]);

  const chars = reduced ? [...text] : turning.chars;
  const turns = reduced ? [] : turning.turns;
  return (
    <span className={`flap flap-${size} tone-${tone}${className ? ` ${className}` : ""}`}>
      <span className="sr-only">{text}</span>
      <span className="flap-tiles" aria-hidden="true">
        {chars.map((ch, i) => (
          <span className={`tile${ch === " " ? " blank" : ""}`} key={i}>
            <span className={turns[i] ? "glyph turned" : "glyph"} key={turns[i] ?? 0}>
              {ch === " " ? " " : ch}
            </span>
          </span>
        ))}
      </span>
    </span>
  );
}

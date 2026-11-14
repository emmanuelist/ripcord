// The cut, in one place (docs/VIDEO.md). Footage times come from the capture's own beat marks (public/capture/take.json),
// so a re-shoot re-times the cut. Segments are cut only between beats; the core take (arm → departed) is one segment.
import take from "../public/capture/take.json";
import durations from "../public/narration/durations.json";
import lines from "../narration/lines.json";

export const FPS = 30;
const at = (name: string) => {
  const m = take.marks.find((x) => x.name === name);
  if (!m) throw new Error(`no mark ${name}`);
  return m.t - take.clockOffset;
};
const footageEnd = take.frames[take.frames.length - 1].t;

export type Segment = { id: string; from: number; to: number; hold?: number; start: number };
const raw: Omit<Segment, "start">[] = [
  { id: "open", from: at("loaded"), to: at("arm-sent") },
  { id: "loop", from: at("arm-sent"), to: at("replay") - 0.2 }, // uncut: arm → ARMED → cross → BOARDING → DEPARTED
  { id: "replay", from: at("replay") - 0.2, to: at("board") - 0.1 },
  { id: "board", from: at("board") - 0.1, to: at("why") - 0.1 },
  { id: "why", from: at("why") - 0.1, to: at("refusals") - 0.1, hold: 3 }, // the note is static: hold its last frame
  { id: "refusals", from: at("refusals") - 0.1, to: at("top") - 0.1 },
  { id: "close", from: at("top") - 0.1, to: Math.min(at("end"), footageEnd), hold: 1.5 },
];
export const segments: Segment[] = [];
let cursor = 0;
for (const s of raw) {
  segments.push({ ...s, start: cursor });
  cursor += s.to - s.from + (s.hold ?? 0);
}
export const TOTAL_S = cursor;

/** Video time of a footage instant inside a segment. */
const v = (seg: string, footage: number) => {
  const s = segments.find((x) => x.id === seg)!;
  return s.start + (footage - s.from);
};

// Each line starts at a footage instant, so it lands on what it names.
const cue: Record<string, [string, number]> = {
  L01: ["open", at("loaded") + 0.4],
  L02: ["open", at("loaded") + 8.2],
  L03: ["loop", at("armed-on-page") - 6.5],
  L04: ["loop", at("cross-sent") + 0.3],
  L05: ["loop", at("departed-on-page") + 0.6],
  L06: ["loop", at("departed-on-page") + 6.9],
  L07: ["replay", at("replay") + 0.2],
  L08: ["board", at("board") + 1.3],
  L09: ["why", at("why") + 0.4],
  L10: ["refusals", at("refusals") + 0.5],
  L11: ["refusals", at("refusal-a") + 0.4],
  L12: ["refusals", at("refusal-b") + 0.4],
  L13: ["refusals", at("refusal-c") + 0.4],
  L14: ["close", at("top") + 0.9],
};
export type Line = { id: string; text: string; start: number; dur: number };
export const narration: Line[] = lines.map((l) => {
  const [seg, f] = cue[l.id];
  return { id: l.id, text: l.text, start: v(seg, f), dur: (durations as Record<string, number>)[l.id] };
});

// On-screen labels for muted viewing: the claim, the live loop, the refusals.
export type Label = { kind: "thesis" | "chip"; text: string; sub?: string; start: number; end: number; left?: number };
const seg = (id: string) => segments.find((s) => s.id === id)!;
const end = (id: string) => seg(id).start + seg(id).to - seg(id).from + (seg(id).hold ?? 0);
export const labels: Label[] = [
  {
    kind: "thesis",
    text: "Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.",
    sub: "Testnet · 50 of 50 measured loops",
    start: 0.2,
    end: end("open"),
  },
  { kind: "chip", text: "Live · not sped up · one take", start: seg("loop").start + 0.3, end: end("loop") },
  { kind: "chip", text: "Replay of the same loop at chain speed", start: seg("replay").start + 0.2, end: end("replay") },
  // Beside the board's title: the top right holds its service strip.
  { kind: "chip", text: "50 of 50 measured loops exited within 3 s", start: seg("board").start + 0.3, end: end("board"), left: 620 },
  // The note's own figures (C-37), large enough to read: on the page they are body text.
  { kind: "chip", text: "Worst half hour, 10 Oct 2025 · ETH fell a median 25.0 bps in 7 s, 15.7 bps in 3 s", start: seg("why").start + 0.3, end: end("why") },
  // Only over the section heading: once the strips scroll in, each is labelled by its own HELD / REVERTED / CANCELLED flap.
  { kind: "chip", text: "The reversal: what it refuses", start: seg("refusals").start + 0.3, end: seg("refusals").start + 5.6 },
  {
    kind: "thesis",
    text: "Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.",
    sub: "Testnet only · not audited · github.com/emmanuelist/ripcord",
    start: seg("close").start + 0.4,
    end: TOTAL_S,
  },
];

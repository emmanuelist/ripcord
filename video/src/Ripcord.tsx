import { AbsoluteFill, Html5Audio, Freeze, OffthreadVideo, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { FPS, labels, narration, segments, type Label } from "./timeline";

// The page's own tokens and fonts (web/src/styles.css): flat paint, hairline rails, no shadows or gradients.
const T = {
  housing: "#16171a",
  panel: "#1b1c20",
  rail: "#2c2e35",
  ink: "#f3efe4",
  ink2: "#c3bfb4",
  yellow: "#f2c230",
  display: "'Barlow Semi Condensed', 'Arial Narrow', sans-serif",
  text: "'Barlow', system-ui, sans-serif",
};
const fonts = `
@font-face { font-family: 'Barlow Semi Condensed'; font-weight: 600; src: url(${staticFile("fonts/display-600.woff2")}) format('woff2'); }
@font-face { font-family: 'Barlow'; font-weight: 400; src: url(${staticFile("fonts/body-400.woff2")}) format('woff2'); }
@font-face { font-family: 'Barlow'; font-weight: 600; src: url(${staticFile("fonts/body-600.woff2")}) format('woff2'); }
`;

const f = (s: number) => Math.round(s * FPS);
const take = staticFile("capture/take.mp4");

const fade = (frame: number, dur: number) =>
  Math.min(interpolate(frame, [0, 8], [0, 1], { extrapolateRight: "clamp" }), interpolate(frame, [dur - 8, dur], [1, 0], { extrapolateLeft: "clamp" }));

function Thesis({ l }: { l: Label }) {
  const frame = useCurrentFrame();
  const o = fade(frame, f(l.end - l.start));
  return (
    // Sits in the hero's empty band, above the headline and level with the departure panel's top edge.
    <div style={{ position: "absolute", left: 32, right: 32, top: 78, opacity: o, display: "flex", alignItems: "flex-start", gap: 28 }}>
      <div style={{ width: 6, alignSelf: "stretch", background: T.yellow }} />
      <div>
        <p style={{ margin: 0, fontFamily: T.display, fontWeight: 600, fontSize: 44, lineHeight: 1.08, color: T.ink, maxWidth: 1700, letterSpacing: "-0.005em" }}>
          {l.text}
        </p>
        {l.sub && (
          <p style={{ margin: "10px 0 0", fontFamily: T.display, fontWeight: 600, fontSize: 20, letterSpacing: "0.1em", textTransform: "uppercase", color: T.yellow }}>
            {l.sub}
          </p>
        )}
      </div>
    </div>
  );
}

function Chip({ l }: { l: Label }) {
  const frame = useCurrentFrame();
  const o = fade(frame, f(l.end - l.start));
  return (
    <div
      style={{
        position: "absolute",
        ...(l.left !== undefined ? { left: l.left } : { right: 32 }),
        top: 76,
        opacity: o,
        background: T.panel,
        border: `1px solid ${T.rail}`,
        borderLeft: `4px solid ${T.yellow}`,
        padding: "12px 20px",
        fontFamily: T.display,
        fontWeight: 600,
        fontSize: 24,
        letterSpacing: "0.08em",
        textTransform: "uppercase",
        color: T.ink,
      }}
    >
      {l.text}
    </div>
  );
}

function Caption({ text, dur }: { text: string; dur: number }) {
  const frame = useCurrentFrame();
  const o = fade(frame, dur);
  return (
    <div
      style={{
        position: "absolute",
        left: 0,
        right: 0,
        bottom: 0,
        opacity: o,
        background: "rgba(22,23,26,0.94)",
        borderTop: `1px solid ${T.rail}`,
        padding: "22px 160px 26px",
        textAlign: "center",
        fontFamily: T.text,
        fontSize: 32,
        lineHeight: 1.3,
        color: T.ink,
      }}
    >
      {text}
    </div>
  );
}

export function Ripcord() {
  return (
    <AbsoluteFill style={{ background: T.housing }}>
      <style>{fonts}</style>
      {segments.map((s) => {
        const len = f(s.to - s.from);
        return (
          <Sequence key={s.id} from={f(s.start)} durationInFrames={len + f(s.hold ?? 0)} name={s.id}>
            <Sequence durationInFrames={len}>
              <OffthreadVideo src={take} trimBefore={f(s.from)} muted />
            </Sequence>
            {s.hold ? (
              <Sequence from={len} durationInFrames={f(s.hold)}>
                <Freeze frame={0}>
                  <OffthreadVideo src={take} trimBefore={f(s.to) - 1} muted />
                </Freeze>
              </Sequence>
            ) : null}
          </Sequence>
        );
      })}
      {labels.map((l, i) => (
        <Sequence key={`label-${i}`} from={f(l.start)} durationInFrames={f(l.end - l.start)}>
          {l.kind === "thesis" ? <Thesis l={l} /> : <Chip l={l} />}
        </Sequence>
      ))}
      {narration.map((n) => (
        <Sequence key={n.id} from={f(n.start)} durationInFrames={f(n.dur + 0.4)} name={n.id}>
          <Html5Audio src={staticFile(`narration/${n.id}.mp3`)} />
          <Caption text={n.text} dur={f(n.dur + 0.4)} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

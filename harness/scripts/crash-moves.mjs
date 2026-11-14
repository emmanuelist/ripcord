// How far ETH fell within w seconds of each second of a window, from Binance 1-second candles (see what-one-second-buys.sh).
// Usage: node crash-moves.mjs <ETHUSDT-1s-DAY.csv> <fromISO> <toISO>
import fs from "node:fs";
const rows = fs.readFileSync(process.argv[2], "utf8").trim().split("\n").map((l) => l.split(","));
const toMs = (t) => (t.length > 13 ? Number(t) / 1000 : Number(t));
const ts = rows.map((r) => toMs(r[0])), close = rows.map((r) => +r[4]), low = rows.map((r) => +r[3]);
const from = Date.parse(process.argv[3]), to = Date.parse(process.argv[4]);
const idx = ts.map((t, i) => [t, i]).filter(([t]) => t >= from && t < to).map(([, i]) => i);
const q = (xs, p) => { const s = [...xs].sort((a, b) => a - b); return s[Math.min(s.length - 1, Math.ceil((p / 100) * s.length) - 1)]; };
const res = { window: [process.argv[3], process.argv[4]], seconds: idx.length, priceFrom: close[idx[0]], priceTo: close[idx.at(-1)] };
for (const w of [1, 3, 7, 9]) {
  const d = idx.map((i) => { let m = Infinity; for (let k = 1; k <= w; k++) m = Math.min(m, low[i + k]); return Math.max(0, (close[i] - m) / close[i]) * 1e4; });
  res[`w${w}s`] = { medianBps: +q(d, 50).toFixed(1), p90Bps: +q(d, 90).toFixed(1), p95Bps: +q(d, 95).toFixed(1), meanBps: +(d.reduce((a, b) => a + b, 0) / d.length).toFixed(1) };
}
console.log(JSON.stringify(res, null, 1));

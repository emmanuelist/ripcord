// Reads the chain once at build time with the page's own code (src/chain), and writes src/data/snapshot.json: every
// position, both chain heads, the pool tick and the refusal room, with the moment and block they were read at. The
// page server-renders from it and starts from it, then goes live. A failed read keeps the previous snapshot.
import { writeFileSync } from "node:fs";
import { createServer } from "vite";

const vite = await createServer({ server: { middlewareMode: true }, appType: "custom", logLevel: "error" });
try {
  const live = await vite.ssrLoadModule("/src/chain/live.ts");
  const { readRefusals } = await vite.ssrLoadModule("/src/chain/refusals.ts");
  const { encode } = await vite.ssrLoadModule("/src/chain/snapshot.ts");
  const readAt = Date.now();
  const [history, tick, refusals] = await Promise.all([live.loadHistory(), live.poll(new Map(), undefined), readRefusals().catch(() => undefined)]);
  const byId = new Map();
  for (const p of history) byId.set(p.tokenId, p);
  for (const [id, p] of tick.changed) byId.set(id, byId.has(id) ? live.mergeRecords(byId.get(id), p) : p);
  if (byId.size < 40) throw new Error(`only ${byId.size} positions read; keeping the previous snapshot`);
  const snap = { uniHead: tick.uniHead, lasnaHead: tick.lasnaHead, poolTick: tick.poolTick, readAt, positions: [...byId.values()], refusals };
  writeFileSync(new URL("../src/data/snapshot.json", import.meta.url), encode(snap) + "\n");
  console.log(`snapshot: ${byId.size} positions, Unichain #${tick.uniHead}, Lasna #${tick.lasnaHead}, refusals ${refusals ? "yes" : "no"}`);
} catch (e) {
  console.warn(`snapshot: ${e instanceof Error ? e.message : e}`);
} finally {
  await vite.close();
}

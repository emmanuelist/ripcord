// Copies the deployment record and the index of recorded loops (ids + tx hashes only) from docs/evidence into
// src/data. The page fetches every displayed value live from chain by these hashes; nothing else is copied.
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const evidence = new URL("../../docs/evidence/", import.meta.url).pathname;
const out = new URL("../src/data/", import.meta.url).pathname;
// On a deploy that uploads only web/ (Vercel CLI), docs/ is absent: keep the committed src/data as it is.
if (!existsSync(join(evidence, "m1/deploy.json"))) {
  console.log("docs/evidence not present; keeping the committed src/data/deploy.json and runs.json");
  process.exit(0);
}
const deploy = JSON.parse(readFileSync(join(evidence, "m1/deploy.json"), "utf8"));
const runs = new Map();
const add = (tokenId, exitTx, lasnaTx, source) => {
  if (tokenId && exitTx && lasnaTx) runs.set(String(tokenId), { tokenId: String(tokenId), exitTx, lasnaTx, source });
};
for (const dir of ["m1", "harness"]) {
  const d = join(evidence, dir);
  if (!existsSync(d)) continue;
  for (const f of readdirSync(d)) {
    if (!/^(loop|run)-\d+\.json$/.test(f)) continue;
    const j = JSON.parse(readFileSync(join(d, f), "utf8"));
    if (j.receipts?.exit?.transactionHash) add(j.tokenId, j.receipts.exit.transactionHash, j.receipts.lasna.transactionHash, `docs/evidence/${dir}/${f}`);
    else if (j.txs?.exit) add(j.tokenId, j.txs.exit, j.txs.lasna, `docs/evidence/${dir}/${f}`);
  }
}
// The RipcordTryout loops (E-020, E-022, E-023): recorded from chain logs by scripts/record-tryout.mjs, so they stay on
// the board after they fall out of the live poll's window.
const tryout = join(evidence, "m3/tryout/loops.json");
if (existsSync(tryout)) {
  for (const l of JSON.parse(readFileSync(tryout, "utf8")).loops) if (l.lasna) add(l.tokenId, l.exit.tx, l.lasna.tx, "docs/evidence/m3/tryout/loops.json");
}
// The M2 refusals (E-016): positions that never exited still belong on the board, rebuilt from their own receipts.
// refusals.json for the page holds the hashes only; every value shown is read back from chain by them.
let refusals = null;
const m2 = join(evidence, "m2/refusals.json");
if (existsSync(m2)) {
  const r = JSON.parse(readFileSync(m2, "utf8"));
  const src = "docs/evidence/m2/refusals.json";
  runs.set(String(r.holds.tokenId), { tokenId: String(r.holds.tokenId), uniTxs: [r.holds.txs.arm, r.direct.disarm.tx], source: src });
  runs.set(String(r.custody.tokenId), { tokenId: String(r.custody.tokenId), uniTxs: [r.custody.txs.arm, r.custody.txs.failed], lasnaTx: r.custody.txs.lasna, source: src });
  refusals = {
    holds: { tokenId: String(r.holds.tokenId), swap: r.holds.txs.swap, reaction: r.holds.txs.reaction },
    direct: { tokenId: String(r.direct.tokenId), tx: r.direct.tx, disarm: r.direct.disarm.tx },
    custody: { tokenId: String(r.custody.tokenId), revoke: r.custody.txs.revoke, swap: r.custody.txs.swap, lasna: r.custody.txs.lasna, failed: r.custody.txs.failed },
    source: src,
  };
}
const index = [...runs.values()].sort((a, b) => Number(BigInt(a.tokenId) - BigInt(b.tokenId)));
writeFileSync(join(out, "deploy.json"), JSON.stringify(deploy, null, 2) + "\n");
writeFileSync(join(out, "runs.json"), JSON.stringify(index, null, 2) + "\n");
if (refusals) writeFileSync(join(out, "refusals.json"), JSON.stringify(refusals, null, 2) + "\n");
console.log(`synced deploy + ${index.length} recorded positions (${index.map((r) => r.tokenId).join(", ")})`);

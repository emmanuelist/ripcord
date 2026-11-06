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
const index = [...runs.values()].sort((a, b) => Number(BigInt(a.tokenId) - BigInt(b.tokenId)));
writeFileSync(join(out, "deploy.json"), JSON.stringify(deploy, null, 2) + "\n");
writeFileSync(join(out, "runs.json"), JSON.stringify(index, null, 2) + "\n");
console.log(`synced deploy + ${index.length} recorded loops (${index.map((r) => r.tokenId).join(", ")})`);

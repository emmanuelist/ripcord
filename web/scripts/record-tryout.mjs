// Records every RipcordTryout loop (positions above the harness's last, #8014) from chain logs into
// docs/evidence/m3/tryout/loops.json: the vault's Exited event (which carries the crossing swap's hash) and Lasna's
// RipcordPulled for the same position, each with its block and block time. sync-evidence then puts them on the board.
//   node scripts/record-tryout.mjs <fromUnichainBlock> <fromLasnaBlock>
import { writeFileSync } from "node:fs";
import { createPublicClient, http, parseAbiItem, toHex } from "viem";

const deploy = JSON.parse(await (await import("node:fs/promises")).readFile(new URL("../src/data/deploy.json", import.meta.url), "utf8"));
const uni = createPublicClient({ transport: http("https://sepolia.unichain.org") });
const las = createPublicClient({ transport: http("https://lasna-rpc.rnk.dev/") });
const exited = parseAbiItem("event Exited(bytes32 indexed poolId, uint256 indexed tokenId, address indexed recipient, int24 triggerTick, int24 observedTick, int24 tickAtExit, uint128 liquidity, uint256 amount0, uint256 amount1, uint256 originBlock, uint256 originTxHash)");
const pulled = parseAbiItem("event RipcordPulled(bytes32 indexed poolId, uint256 indexed tokenId, int24 observedTick, uint256 originBlock, uint256 originTxHash)");
const [uFrom, lFrom] = process.argv.slice(2).map(BigInt);
const STEP = 999n; // Unichain's public RPC answers at most 1,000 blocks per getLogs

async function logs(client, address, event, from) {
  const head = await client.getBlockNumber();
  const out = [];
  for (let b = from; b <= head; b += STEP + 1n) out.push(...(await client.getLogs({ address, event, fromBlock: b, toBlock: b + STEP > head ? head : b + STEP })));
  return out;
}
const time = async (c, n) => Number((await c.getBlock({ blockNumber: n })).timestamp);

const exits = (await logs(uni, deploy.ripcordVault, exited, uFrom)).filter((l) => l.args.tokenId > 8014n);
const pulls = await logs(las, deploy.ripcordReactive, pulled, lFrom);
const loops = [];
for (const e of exits) {
  const id = e.args.tokenId;
  const p = pulls.find((x) => x.args.tokenId === id);
  const swapBlock = e.args.originBlock;
  const swapTx = toHex(e.args.originTxHash, { size: 32 });
  const [st, et, lt] = await Promise.all([time(uni, swapBlock), time(uni, e.blockNumber), p ? time(las, p.blockNumber) : undefined]);
  loops.push({
    tokenId: String(id),
    swap: { tx: swapTx, block: Number(swapBlock), time: st },
    lasna: p ? { tx: p.transactionHash, block: Number(p.blockNumber), time: lt } : null,
    exit: { tx: e.transactionHash, block: Number(e.blockNumber), time: et },
    swapToExitBlocks: Number(e.blockNumber - swapBlock),
    swapToExitSeconds: et - st,
  });
}
const out = new URL("../../docs/evidence/m3/tryout/loops.json", import.meta.url);
writeFileSync(out, JSON.stringify({ note: "RipcordTryout loops, read from the vault's Exited and Lasna's RipcordPulled logs (web/scripts/record-tryout.mjs).", recordedAt: new Date().toISOString(), loops }, null, 2) + "\n");
for (const l of loops) console.log(l.tokenId, `${l.swapToExitBlocks} blocks`, `${l.swapToExitSeconds} s`, l.lasna ? "lasna ok" : "NO LASNA");

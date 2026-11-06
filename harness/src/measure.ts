/**
 * Ripcord latency harness. For each run it:
 *   1. (untimed) mints a fresh v4 position, approves the vault, arms a line GAP ticks past the price, and waits until
 *      RipcordReactive on Lasna is tracking it;
 *   2. pre-signs one swap across the line, starts three concurrent watchers (swap receipt on Unichain, RipcordPulled
 *      on Lasna, Exited/ExitFailed on Unichain), then broadcasts the swap;
 *   3. records each hop as a bounded wall-clock interval plus the on-chain block and timestamp truth.
 *
 *   RUNS=3 npm run measure        (reads ../.env and ../docs/evidence/m1/deploy.json)
 *
 * Signing never touches a key in this process: `cast mktx` signs with the encrypted Foundry keystore (D-007).
 */
import { execFile } from "node:child_process";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import {
  createPublicClient,
  decodeEventLog,
  defineChain,
  encodeEventTopics,
  http,
  keccak256,
  numberToHex,
  type Address,
  type Hex,
  type Log,
  type PublicClient,
} from "viem";
import { erc721Transfer, exitFailed, exited, lineTracked, ripcordPulled, stateViewAbi } from "./abi.js";
import { encodeApprove, encodeArm, encodeMint, encodeSwap, planRun, type PoolKey } from "./encode.js";
import { hopBounds, median, percentile, watch, type Sighting } from "./timing.js";

const run = promisify(execFile);

const env = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name} (run with --env-file=../.env)`);
  return v;
};

interface Deploy {
  token0: Address;
  token1: Address;
  poolId: Hex;
  ripcordVault: Address;
  ripcordReactive: Address;
  positionManager: Address;
  stateView: Address;
  swapRouter: Address;
}

// Minimal chain definitions: the harness needs receipts, logs and raw sends only. viem's built-in unichainSepolia adds
// OP-stack formatters whose types don't unify with a plain PublicClient.
const unichain = defineChain({
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.unichain.org"] } },
});

const lasna = defineChain({
  id: 5318007,
  name: "Reactive Lasna",
  nativeCurrency: { name: "lREACT", symbol: "lREACT", decimals: 18 },
  rpcUrls: { default: { http: ["https://lasna-rpc.rnk.dev/"] } },
});

async function main() {
  const runs = Number(process.env.RUNS ?? "1");
  const gap = Number(process.env.GAP ?? "120");
  const swapIn = BigInt(process.env.SWAP_IN ?? "10000000000000000000");
  const intervalMs = Number(process.env.POLL_MS ?? "50");
  const outDir = process.env.OUT_DIR ?? "../docs/evidence/harness";
  const deploy = JSON.parse(await readFile("../docs/evidence/m1/deploy.json", "utf8")) as Deploy;
  const owner = env("DEPLOYER_ADDRESS") as Address;
  const key: PoolKey = {
    currency0: deploy.token0,
    currency1: deploy.token1,
    fee: 3000,
    tickSpacing: 60,
    hooks: "0x0000000000000000000000000000000000000000",
  };

  const uni = createPublicClient({ chain: unichain, transport: http(env("UNICHAIN_SEPOLIA_RPC")) });
  const las = createPublicClient({ chain: lasna, transport: http(env("LASNA_RPC")) });
  if ((await uni.getChainId()) !== 1301 || (await las.getChainId()) !== 5318007) throw new Error("wrong RPCs");

  const t0 = performance.now();
  const now = () => performance.now() - t0;
  await mkdir(outDir, { recursive: true });
  const results: RunResult[] = [];

  for (let i = 1; i <= runs; i++) {
    const r = await oneRun(i, { uni, las, deploy, key, owner, gap, swapIn, intervalMs, now });
    results.push(r);
    await writeFile(`${outDir}/run-${r.tokenId}.json`, JSON.stringify(r, bigintJson, 2));
    console.log(
      `run ${i} · tokenId ${r.tokenId} · ${r.result} · swap→exit ${r.onchain.unichainBlocks} blocks / ${r.onchain.unichainSeconds} s on-chain · ` +
        `wall: swap→Lasna ${fmt(r.wall.swapToLasna)} · swap→exit ${fmt(r.wall.swapToExit)} · RTT uni ${r.rpc.uniPollMs} ms, lasna ${r.rpc.lasnaPollMs} ms`,
    );
  }

  const ok = results.filter((r) => r.result === "exited");
  if (ok.length > 0) {
    const mid = (b: { minMs: number; maxMs: number }) => (b.minMs + b.maxMs) / 2;
    const summary = {
      runs: results.length,
      exited: ok.length,
      unichainBlocksSwapToExit: { median: median(ok.map((r) => r.onchain.unichainBlocks)), max: Math.max(...ok.map((r) => r.onchain.unichainBlocks)) },
      wallSwapToExitMidMs: { median: median(ok.map((r) => mid(r.wall.swapToExit))), p90: percentile(ok.map((r) => mid(r.wall.swapToExit)), 90) },
      wallSwapToExitMaxMs: { median: median(ok.map((r) => r.wall.swapToExit.maxMs)), p90: percentile(ok.map((r) => r.wall.swapToExit.maxMs), 90) },
      wallSwapToLasnaMidMs: { median: median(ok.map((r) => mid(r.wall.swapToLasna))) },
      tokenIds: results.map((r) => r.tokenId),
    };
    await writeFile(`${outDir}/summary-${Date.now()}.json`, JSON.stringify(summary, null, 2));
    console.log("summary", JSON.stringify(summary));
  }
}

interface Ctx {
  uni: PublicClient;
  las: PublicClient;
  deploy: Deploy;
  key: PoolKey;
  owner: Address;
  gap: number;
  swapIn: bigint;
  intervalMs: number;
  now: () => number;
}

interface Bounds {
  minMs: number;
  maxMs: number;
}

interface RunResult {
  run: number;
  tokenId: string;
  result: "exited" | "exit-failed";
  line: number;
  exitBelow: boolean;
  tickBefore: number;
  txs: { mint: Hex; approve: Hex; arm: Hex; swap: Hex; lasna: Hex; exit: Hex };
  onchain: { swapBlock: bigint; exitBlock: bigint; unichainBlocks: number; unichainSeconds: number; lasnaBlock: bigint };
  wall: { sendToSwapSeen: Bounds; swapToLasna: Bounds; swapToExit: Bounds };
  sightings: { swap: Omit<Sighting<unknown>, "value">; lasna: Omit<Sighting<unknown>, "value">; exit: Omit<Sighting<unknown>, "value"> };
  rpc: { uniPollMs: number; lasnaPollMs: number; pollIntervalMs: number };
  measuredAt: string;
}

async function oneRun(i: number, c: Ctx): Promise<RunResult> {
  const { uni, las, deploy, key, owner } = c;
  // ---- 1. untimed preparation ----
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 600);
  const mintTx = await sendSigned(uni, deploy.positionManager, encodeMint(key, -6000, 6000, 1_000n * 10n ** 18n, owner, deadline));
  const mintRcpt = await uni.waitForTransactionReceipt({ hash: mintTx, pollingInterval: 200 });
  const tokenId = mintedTokenId(mintRcpt.logs, deploy.positionManager, owner);

  const approveTx = await sendSigned(uni, deploy.positionManager, encodeApprove(deploy.ripcordVault, tokenId));
  await uni.waitForTransactionReceipt({ hash: approveTx, pollingInterval: 200 });

  const tickBefore = await currentTick(uni, deploy);
  const plan = planRun(i, tickBefore, c.gap);
  const lasnaFrom = await las.getBlockNumber();
  const armTx = await sendSigned(uni, deploy.ripcordVault, encodeArm(tokenId, plan.line, plan.exitBelow));
  await uni.waitForTransactionReceipt({ hash: armTx, pollingInterval: 200 });
  const trackedTopics = encodeEventTopics({ abi: [lineTracked], args: { poolId: deploy.poolId, tokenId } });
  await watch(() => firstLog(las, deploy.ripcordReactive, trackedTopics, lasnaFrom), {
    intervalMs: 500,
    timeoutMs: 90_000,
    now: c.now,
  });

  // ---- 2. timed loop: pre-sign, start all three watchers, then broadcast ----
  const swapRaw = await mktx(deploy.swapRouter, encodeSwap(key, plan.zeroForOne, c.swapIn));
  const swapHash = keccak256(swapRaw);
  const uniFrom = await uni.getBlockNumber();
  const lasFrom = await las.getBlockNumber();
  const pulledTopics = encodeEventTopics({ abi: [ripcordPulled], args: { poolId: deploy.poolId, tokenId } });
  const exitTopics: (Hex | Hex[] | null)[] = [
    [topic0(exited), topic0(exitFailed)],
    deploy.poolId,
    numberToHex(tokenId, { size: 32 }),
  ];
  const opts = { intervalMs: c.intervalMs, timeoutMs: 120_000, now: c.now };

  const sendAt = c.now();
  const swapWatch = watch(async () => {
    try {
      return await uni.getTransactionReceipt({ hash: swapHash });
    } catch {
      return undefined;
    }
  }, opts);
  const lasnaWatch = watch(() => firstLog(las, deploy.ripcordReactive, pulledTopics, lasFrom), opts);
  const exitWatch = watch(() => firstLog(uni, deploy.ripcordVault, exitTopics, uniFrom), opts);
  await uni.sendRawTransaction({ serializedTransaction: swapRaw });
  const [swapSeen, lasnaSeen, exitSeen] = await Promise.all([swapWatch, lasnaWatch, exitWatch]);

  // ---- 3. on-chain truth ----
  const swapBlock = swapSeen.value.blockNumber;
  const exitLog = exitSeen.value;
  const exitBlock = exitLog.blockNumber;
  const [swapB, exitB] = await Promise.all([uni.getBlock({ blockNumber: swapBlock }), uni.getBlock({ blockNumber: exitBlock })]);
  const decodedExit = decodeEventLog({ abi: [exited, exitFailed], data: exitLog.data, topics: exitLog.topics });
  // Raw eth_blockNumber: viem's getBlockNumber() is cached (~4 s), which would time the cache, not the network.
  const uniPollMs = await rtt(() => uni.request({ method: "eth_blockNumber" }));
  const lasnaPollMs = await rtt(() => las.request({ method: "eth_blockNumber" }));
  const strip = <T,>(s: Sighting<T>) => ({ lowerMs: s.lowerMs, upperMs: s.upperMs, polls: s.polls });

  return {
    run: i,
    tokenId: tokenId.toString(),
    result: decodedExit.eventName === "Exited" ? "exited" : "exit-failed",
    line: plan.line,
    exitBelow: plan.exitBelow,
    tickBefore,
    txs: { mint: mintTx, approve: approveTx, arm: armTx, swap: swapHash, lasna: lasnaSeen.value.transactionHash, exit: exitLog.transactionHash },
    onchain: {
      swapBlock,
      exitBlock,
      lasnaBlock: lasnaSeen.value.blockNumber,
      unichainBlocks: Number(exitBlock - swapBlock),
      unichainSeconds: Number(exitB.timestamp - swapB.timestamp),
    },
    wall: {
      sendToSwapSeen: hopBounds({ lowerMs: sendAt, upperMs: sendAt }, swapSeen),
      swapToLasna: hopBounds(swapSeen, lasnaSeen),
      swapToExit: hopBounds(swapSeen, exitSeen),
    },
    sightings: { swap: strip(swapSeen), lasna: strip(lasnaSeen), exit: strip(exitSeen) },
    rpc: { uniPollMs, lasnaPollMs, pollIntervalMs: c.intervalMs },
    measuredAt: new Date().toISOString(),
  };
}

interface FoundLog {
  blockNumber: bigint;
  transactionHash: Hex;
  data: Hex;
  topics: [Hex, ...Hex[]];
}

/** The first log at `address` matching exact `topics` since `fromBlock`, via raw eth_getLogs. */
async function firstLog(
  client: PublicClient,
  address: Address,
  topics: (Hex | Hex[] | null)[],
  fromBlock: bigint,
): Promise<FoundLog | undefined> {
  const logs = await client.request({
    method: "eth_getLogs",
    params: [{ address, topics, fromBlock: numberToHex(fromBlock), toBlock: "latest" }],
  });
  const l = logs[0];
  const [sig, ...rest] = l?.topics ?? [];
  if (!l || !sig || !l.blockNumber || !l.transactionHash) return undefined;
  return { blockNumber: BigInt(l.blockNumber), transactionHash: l.transactionHash, data: l.data, topics: [sig, ...rest] };
}

/** topic0 of an event ABI item. */
function topic0(event: typeof exited | typeof exitFailed): Hex {
  const [t] = encodeEventTopics({ abi: [event] });
  if (!t || Array.isArray(t)) throw new Error("no topic0");
  return t;
}

function mintedTokenId(logs: readonly Log[], positionManager: Address, owner: Address): bigint {
  for (const l of logs) {
    if (l.address.toLowerCase() !== positionManager.toLowerCase()) continue;
    try {
      const ev = decodeEventLog({ abi: [erc721Transfer], data: l.data, topics: l.topics });
      if (ev.args.to.toLowerCase() === owner.toLowerCase()) return ev.args.id;
    } catch {
      /* not a Transfer */
    }
  }
  throw new Error("mint receipt has no Transfer to the owner");
}

async function currentTick(client: PublicClient, d: Deploy): Promise<number> {
  const [, tick] = await client.readContract({ address: d.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [d.poolId] });
  return tick;
}

/** Signs with the encrypted keystore via `cast mktx` (nonce and fees from the RPC). The key never enters Node. */
async function mktx(to: Address, data: Hex): Promise<Hex> {
  const { stdout } = await run("cast", [
    "mktx",
    "--rpc-url",
    env("UNICHAIN_SEPOLIA_RPC"),
    "--account",
    env("ACCOUNT"),
    "--password-file",
    env("KEYSTORE_PASSWORD_FILE"),
    to,
    data,
  ]);
  return stdout.trim() as Hex;
}

async function sendSigned(client: PublicClient, to: Address, data: Hex): Promise<Hex> {
  return client.sendRawTransaction({ serializedTransaction: await mktx(to, data) });
}

async function rtt(f: () => Promise<unknown>): Promise<number> {
  const samples: number[] = [];
  for (let i = 0; i < 5; i++) {
    const s = performance.now();
    await f();
    samples.push(performance.now() - s);
  }
  return Math.round(median(samples));
}

const fmt = (b: Bounds) => `[${Math.round(b.minMs)}, ${Math.round(b.maxMs)}] ms`;
const bigintJson = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

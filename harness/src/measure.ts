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
import { mkdir, writeFile } from "node:fs/promises";
import { decodeEventLog, encodeEventTopics, keccak256, numberToHex, type Address, type Hex, type PublicClient } from "viem";
import { exitFailed, exited, lineTracked, ripcordPulled } from "./abi.js";
import { bigintJson, clients, currentTick, env, firstLog, loadDeploy, mintedTokenId, mktx, poolKey, sendSigned, type Deploy } from "./chain.js";
import { encodeApprove, encodeArm, encodeMint, encodeSwap, planRun, type PoolKey } from "./encode.js";
import { hopBounds, median, percentile, watch, type Sighting } from "./timing.js";

async function main() {
  const runs = Number(process.env.RUNS ?? "1");
  const gap = Number(process.env.GAP ?? "120");
  // A cap, not a size: the swap stops at its price limit just past the line (planRun).
  const swapIn = BigInt(process.env.SWAP_IN ?? "100000000000000000000000");
  const intervalMs = Number(process.env.POLL_MS ?? "50");
  const outDir = process.env.OUT_DIR ?? "../docs/evidence/harness";
  const deploy = await loadDeploy();
  const owner = env("DEPLOYER_ADDRESS") as Address;
  const key = poolKey(deploy);

  const { uni, las } = await clients();

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
  const swapRaw = await mktx(deploy.swapRouter, encodeSwap(key, plan.zeroForOne, c.swapIn, plan.sqrtPriceLimitX96));
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

/** topic0 of an event ABI item. */
function topic0(event: typeof exited | typeof exitFailed): Hex {
  const [t] = encodeEventTopics({ abi: [event] });
  if (!t || Array.isArray(t)) throw new Error("no topic0");
  return t;
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

main().catch((e: unknown) => {
  console.error(e);
  process.exit(1);
});

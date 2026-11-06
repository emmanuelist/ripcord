/**
 * Chain plumbing shared by the harness scripts (measure.ts, reversals.ts): the two chains, the deployment record, raw
 * log lookups, and signing through the encrypted Foundry keystore. The key never enters Node (D-007).
 */
import { execFile } from "node:child_process";
import { readFile } from "node:fs/promises";
import { promisify } from "node:util";
import { createPublicClient, decodeEventLog, defineChain, http, numberToHex, type Address, type Hex, type Log, type PublicClient } from "viem";
import { erc721Transfer, stateViewAbi } from "./abi.js";
import type { PoolKey } from "./encode.js";

const run = promisify(execFile);

export const env = (name: string): string => {
  const v = process.env[name];
  if (!v) throw new Error(`missing env ${name} (run with --env-file=../.env)`);
  return v;
};

export interface Deploy {
  token0: Address;
  token1: Address;
  poolId: Hex;
  ripcordVault: Address;
  ripcordReactive: Address;
  callbackProxy: Address;
  poolManager: Address;
  positionManager: Address;
  stateView: Address;
  swapRouter: Address;
}

export const unichain = defineChain({
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.unichain.org"] } },
});

export const lasna = defineChain({
  id: 5318007,
  name: "Reactive Lasna",
  nativeCurrency: { name: "lREACT", symbol: "lREACT", decimals: 18 },
  rpcUrls: { default: { http: ["https://lasna-rpc.rnk.dev/"] } },
});

export async function loadDeploy(): Promise<Deploy> {
  return JSON.parse(await readFile("../docs/evidence/m1/deploy.json", "utf8")) as Deploy;
}

export function poolKey(d: Deploy): PoolKey {
  return { currency0: d.token0, currency1: d.token1, fee: 3000, tickSpacing: 60, hooks: "0x0000000000000000000000000000000000000000" };
}

/** Both chains from the RPCs in .env, refusing to run against the wrong ones. */
export async function clients(): Promise<{ uni: PublicClient; las: PublicClient }> {
  const uni = createPublicClient({ chain: unichain, transport: http(env("UNICHAIN_SEPOLIA_RPC")) });
  const las = createPublicClient({ chain: lasna, transport: http(env("LASNA_RPC")) });
  if ((await uni.getChainId()) !== 1301 || (await las.getChainId()) !== 5318007) throw new Error("wrong RPCs");
  return { uni, las };
}

export interface FoundLog {
  blockNumber: bigint;
  transactionHash: Hex;
  data: Hex;
  topics: [Hex, ...Hex[]];
}

/** The first log at `address` matching exact `topics` since `fromBlock`, via raw eth_getLogs. */
export async function firstLog(
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

export function mintedTokenId(logs: readonly Log[], positionManager: Address, owner: Address): bigint {
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

export async function currentTick(client: PublicClient, d: Deploy): Promise<number> {
  const [, tick] = await client.readContract({ address: d.stateView, abi: stateViewAbi, functionName: "getSlot0", args: [d.poolId] });
  return tick;
}

/**
 * Signs with the encrypted keystore via `cast mktx` (nonce and fees from the RPC). The key never enters Node.
 * `gasLimit` skips gas estimation: needed to put a transaction that will revert on-chain, so it has a hash.
 */
export async function mktx(to: Address, data: Hex, opts: { gasLimit?: bigint } = {}): Promise<Hex> {
  const gas = opts.gasLimit !== undefined ? ["--gas-limit", opts.gasLimit.toString()] : [];
  const { stdout } = await run("cast", [
    "mktx",
    "--rpc-url",
    env("UNICHAIN_SEPOLIA_RPC"),
    "--account",
    env("ACCOUNT"),
    "--password-file",
    env("KEYSTORE_PASSWORD_FILE"),
    ...gas,
    to,
    data,
  ]);
  return stdout.trim() as Hex;
}

export async function sendSigned(client: PublicClient, to: Address, data: Hex, opts: { gasLimit?: bigint } = {}): Promise<Hex> {
  return client.sendRawTransaction({ serializedTransaction: await mktx(to, data, opts) });
}

export const bigintJson = (_k: string, v: unknown) => (typeof v === "bigint" ? v.toString() : v);

import { createPublicClient, defineChain, http, type Address, type Hex } from "viem";
import deployJson from "../data/deploy.json";

export interface Deploy {
  poolChainId: number;
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

export const deploy = deployJson as Deploy;

export const unichainSepolia = defineChain({
  id: 1301,
  name: "Unichain Sepolia",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://sepolia.unichain.org"] } },
  blockExplorers: { default: { name: "Uniscan", url: "https://sepolia.uniscan.xyz" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const lasna = defineChain({
  id: 5318007,
  name: "Reactive Lasna",
  nativeCurrency: { name: "lREACT", symbol: "lREACT", decimals: 18 },
  rpcUrls: { default: { http: ["https://lasna-rpc.rnk.dev/"] } },
  blockExplorers: { default: { name: "Reactscan", url: "https://lasna.reactscan.net" } },
});

// Both public RPCs allow browser CORS and JSON-RPC batching (checked 2026-11-06), so one poll tick is one HTTP request
// per chain.
export const uni = createPublicClient({ chain: unichainSepolia, transport: http(undefined, { batch: { wait: 16 } }) });
export const las = createPublicClient({ chain: lasna, transport: http(undefined, { batch: { wait: 16 } }) });

export const txUrl = (chain: "unichain" | "lasna", hash: string) =>
  chain === "unichain" ? `https://sepolia.uniscan.xyz/tx/${hash}` : `https://lasna.reactscan.net/tx/${hash}`;
export const addressUrl = (chain: "unichain" | "lasna", address: string) =>
  chain === "unichain" ? `https://sepolia.uniscan.xyz/address/${address}` : `https://lasna.reactscan.net/address/${address}`;

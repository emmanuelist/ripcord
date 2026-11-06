# Context
Verified facts about everything this project depends on. Each entry says how it was verified, so no session has to re-derive it or trust training data. Read this before touching an integration.

- `[E-001]` means checked on-chain on 2026-11-06 (see `docs/evidence/E-001-dependency-checks-2026-11-06.txt`).
- `[docs]` means taken from official docs but not independently checked.

## Networks
| Name | Chain ID | RPC (env var) | Explorer | Verified |
|---|---|---|---|---|
| Reactive Lasna (testnet, Omni) | 5318007 | `LASNA_RPC` = https://lasna-rpc.rnk.dev/ | https://lasna.reactscan.net/ | chain ID, ~1.07 s blocks, gas price 100 gwei [E-001]; explorer [docs] |
| Unichain Sepolia | 1301 | `UNICHAIN_SEPOLIA_RPC` = https://sepolia.unichain.org | https://sepolia.uniscan.xyz | chain ID, 1.0 s blocks [E-001] |
| Base Sepolia | 84532 | `BASE_SEPOLIA_RPC` = https://sepolia.base.org | https://sepolia.basescan.org | chain ID, 0.2 s blocks [E-001] |
| Ethereum Sepolia | 11155111 | `SEPOLIA_RPC` | https://sepolia.etherscan.io | [docs] only (used just for the lREACT faucet) |
| Reactive mainnet | 1597 | https://mainnet-rpc.rnk.dev/ | https://reactscan.net/ | [docs]. Not used: testnets only |

## Contracts we call
| Name | Address | Source of address | Interface | Verified how |
|---|---|---|---|---|
| Reactive system contract (Lasna, Omni) | `0x8888888888888888888888888888888888888888` | reactive-lib-omni `AbstractReactive.SYSTEM`; docs /reactive-mainnet | `ISystemContract` (reactive-lib-omni v0.1.0) | bytecode [E-001] |
| Callback proxy, Unichain Sepolia | `0x775c9B990ADe401060B78D0e98684eEf8d2466C1` | dev.reactive.network/origins-and-destinations | `IPayable` | bytecode [E-001] |
| Callback proxy, Base Sepolia | `0x476F44b11F5C942c58f4c8E3d0300E5710743585` | same page (the docs also list this address for Robinhood mainnet) | `IPayable` | bytecode [E-001] |
| Callback proxy, Ethereum Sepolia | `0xAa14d9Cd0f788Ca23d11805986C1d8bd035D23b4` | same page | `IPayable` | [docs] only |
| lREACT faucet, Base Sepolia | `0x2afaFD298b23b62760711756088F75B7409f5967` | docs /reactive-mainnet | `request(address)` payable | bytecode [E-001] |
| lREACT faucet, Ethereum Sepolia | `0x9b9BB25f1A81078C544C829c5EB7822d747Cf434` | docs /reactive-mainnet | `request(address)` payable | [docs] only |
| v4 PoolManager, Unichain Sepolia | `0x00b036b58a818b1bc34d502d3fe730db729e62ac` | Uniswap/docs `content/protocols/v4/deployments.mdx` | `IPoolManager` (v4-core v4.0.0) | bytecode [E-001] |
| v4 PositionManager, Unichain Sepolia | `0xf969aee60879c54baaed9f3ed26147db216fd664` | same | `IPositionManager` (v4-periphery) | bytecode + selectors [E-001] |
| v4 StateView, Unichain Sepolia | `0xc199f1072a74d4e905aba1a84d9a45e2546b6222` | same | `StateView` | bytecode [E-001] |
| v4 PoolSwapTest / PoolModifyLiquidityTest, Unichain Sepolia | `0x9140a78c1a137c7ff1c151ec8231272af78a99a4` / `0x5fa728c0a5cfd51bee4b060773f50554c0c8a7ab` | same | v4-core test routers | bytecode [E-001] |
| v4 PoolManager, Base Sepolia | `0x05E73354cFDd6745C338b50BcFDfA3Aa6fA03408` | same | `IPoolManager` | bytecode [E-001] |
| v4 PositionManager, Base Sepolia | `0x4b2c77d209d3405f41a037ec6c77f7f5b8e2ca80` | same | `IPositionManager` | bytecode + selectors [E-001] |
| v4 StateView, Base Sepolia | `0x571291b572ed32ce6751a2cb2486ebee8defb9b4` | same | `StateView` | bytecode [E-001] |
| v4 PoolSwapTest / PoolModifyLiquidityTest, Base Sepolia | `0x8b5bcc363dde2614281ad875bad385e0a785d3b9` / `0x37429cd17cb1454c34e7f50b09725202fd533039` | same | v4-core test routers | bytecode [E-001] |
| Permit2 (both chains) | `0x000000000022D473030F116dDEE9F6B43aC78BA3` | same | Permit2 | [docs] only |

## SDKs and exact signatures
| Package | Pinned | Calls we use | Verified in |
|---|---|---|---|
| reactive-lib-omni | v0.1.0 (`3ade0dcf1d27`) | `SYSTEM.subscribe(uint256 chainId, address contract, uint256 t0, uint256 t1, uint256 t2, uint256 t3)`. Wildcard `REACTIVE_IGNORE = 0xa65f96fc951c35ead38878e0f0b7a3c744a6f5ccc1476b313353ce31712313ad`. `SYSTEM.requestCallbackV_1_0(CallbackConfiguration_V_1_0{uint256 chainId; address recipient; uint64 gasLimit; bytes payload})`. `modifier onlySystem`. `AbstractCallback(IPayable callbackProxy, address callbackSender)` + `onlyCallbackSender(address)`. `AbstractPayer`: `receive()`, `pay(uint256)` (onlyServiceProvider), `_coverDebt()` (internal, so expose a wrapper) | source: `src/base/AbstractReactive.sol`, `AbstractCallback.sol`, `AbstractPayer.sol`, `interfaces/ISystemContract.sol`, `ISubscriptionService.sol` (read 2026-11-06) |
| v4-core | 1.0.2 (`59d3ecf53afa`) via v4-periphery's submodule. ABI-identical to the deployed v4.0.0 (D-006) | `event Swap(PoolId indexed id, address indexed sender, int128 amount0, int128 amount1, uint160 sqrtPriceX96, uint128 liquidity, int24 tick, uint24 fee)`. topic0 = `0x40e9cecb9f5f1f1c5b9c97dec2917b7ee92e57ba5563708daca94dd84ad7112f`, topic1 = poolId, topic2 = swap router (msg.sender to PoolManager), and `tick` sits in data | `src/interfaces/IPoolManager.sol` (same at v4.0.0 and 1.0.2). topic0 via `cast keccak` [E-001] |
| v4-periphery | `c6e4754dab11` (main, 2026-10-26; no tags exist) | `modifyLiquidities(bytes unlockData, uint256 deadline)` `0xdd46508f`. `getPoolAndPositionInfo(uint256)` `0x7ba03aad`. `getPositionLiquidity(uint256)` `0x1efeed33`. `nextTokenId()` `0x75794a3c`. `ownerOf(uint256)` `0x6352211e`. Actions: `DECREASE_LIQUIDITY = 0x01`, `MINT_POSITION = 0x02`, `BURN_POSITION = 0x03`, `SETTLE_PAIR = 0x0d`, `TAKE_PAIR = 0x11`, `CLOSE_CURRENCY = 0x12` | `src/interfaces/IPositionManager.sol`, `src/libraries/Actions.sol` (main, 2026-11-06). Selectors present in both deployed PositionManagers [E-001] |

## Reactive behaviour
All of these are [docs] unless marked. Re-verify each in spike S1 and S2.
- Reactive overwrites the **first 160 bits of the callback payload** with the requesting reactive contract's address. Pass `address(0)` as the first argument.
- Minimum callback gas limit is **100,000**. Requests below it are ignored. The reactive tx gas cap is **900,000**.
- Callback cost is charged to the callback contract in the destination's native token, and reactive txs are charged in lREACT.
  - Debt blocks execution: the proxy reverts with `InDebt` before delivery.
  - Failed `react()` and failed callbacks are still charged.
  - Fund with a payable constructor, `receive()`, or `depositTo(address)` on the system contract or proxy.
- Subscriptions match on equality only. `chainId 0` means any chain and `address(0)` means any contract, but at least one criterion must be specific.
- **[reported]** another entrant (emilhuseyn/reactive-omni) measured a Base Sepolia → Lasna → Base Sepolia loop at 1–2 s in 5/5 runs. Not our evidence.

## Traps
- **viem `getBlockNumber()` is cached (~4 s).** Timed in a loop it returns in 0 ms. Use `client.request({ method: "eth_blockNumber" })` to measure RTT (harness fix, E-010).
- **Public-RPC visibility trails block inclusion.** In harness run 7945 the exit's log became visible ≥3.9 s after the swap receipt, though the blocks are 3 s apart. Quote N from on-chain block deltas, and wall clock as "what a UI sees".
- **RPC round trips from this machine (2026-11-06, VPN on):** Unichain ~311 ms, Lasna ~460–590 ms (`eth_getLogs` ~317 / ~593 ms), and 1.5–2 s for a first request on a new TLS connection.
- **npm `ERR_SSL_CIPHER_OPERATION_FAILED`** (Node 26.7.0 / OpenSSL 3.6.3) killed `npm install` mid-download of large tarballs twice. It succeeded with `--maxsockets=2` *after the user turned a VPN on*, so the cause is unconfirmed (both changed at once). Try `--maxsockets=2` first.
- **npm 11 skips install scripts by default** (it warned about esbuild's postinstall). tsx and vitest still work, because esbuild's binary comes from its `@esbuild/darwin-arm64` optional dependency.
- **`subscribe()` / `unsubscribe()` inside `react()` work on Omni** (E-009): RipcordReactive subscribes to a pool's Swap topic when its first line is armed, and the next swap is delivered. The fire-and-unsubscribe `react()` used 106,801 gas.
- **Shell polling can't time hops.** Each `cast logs` call costs 1.0–1.5 s (process spawn + RPC, 2026-11-06), and the demo script polls Lasna then Unichain in sequence. Its wall-clock figures are inflated upper bounds (15–19 s against 2 s on-chain). Use on-chain block deltas, or a persistent-connection harness watching every hop at once.
- **`cast logs` with a bare event signature mis-filters indexed topics.** With `Transfer(address,address,uint256)` plus three values, a filter for tokenId 7942 still matched 7943, because cast can't know which params are indexed. Write `indexed` in the signature (`Transfer(address indexed,address indexed,uint256 indexed)`) or pass raw topic hashes: both filter exactly (tested on Unichain Sepolia, 2026-11-06). Every script here uses annotated signatures.
- **forge-lint suppression scope.** `// forge-lint: disable-next-line(<lint>)` covers one line only, so a multi-line statement (an `emit` or a call with a struct literal) needs `// forge-lint: disable-start(<lint>)` … `// forge-lint: disable-end(<lint>)`. Every suppression in this repo carries a comment saying why (forge 1.8.3, 2026-11-06).
- **Reactive gas budget per `react()`:** one callback request measured at 84,360 gas for the whole reactive tx (E-005), so ~60k per fired line. Lasna caps a reactive tx at 900k, which sets the cap at 8 lines per pool (D-012).
- **Callback `gasLimit` is the relayer's whole transaction limit, not your function's budget.** The relayer sends the tx with gas = the requested `gasLimit`. `CallbackProxy._callback` (system-smart-contracts `src/omni/CallbackProxy.sol` @ 72710d2) forwards only `gasleft() − (_extraGas + _maxChargeGas + failureEventGas)`. **Observed overhead: 176,488 gas** (200k request → 23,512 forwarded → `OutOfGas` → `CallbackFailure(target, payload)`, **still charged**). Request ≥ your function's cost + ~180k. Fees use gas *used*, so a high limit is free. (`test/utils/ReactiveBudget.sol`, E-005)
- **Injected sender verified on Omni:** the callback's first argument arrives as the **requesting reactive contract's address** (5/5 loops, E-005), matching the docs. Guard callbacks with `onlyServiceProvider` (proxy) **and** `onlyCallbackSender(<reactive contract address>)`.
- **Lasna block timestamps run ~1 s behind Unichain Sepolia's** for the same causal loop, so cross-chain timestamp deltas are invalid. Time hops by wall clock (M1 harness). Lasna react txs are sent from `0x038e06667e42782e571eab20432b9237f9bd6b82` to the system contract. Unichain deliveries come from relayer `0xf7e866d726658f6c3f14b8ee537fe268a4d91ddb`, which gets the fee as a kickback.
- **Funding paths that worked (2026-11-06):**
  - The Sepolia lREACT faucet paid **105 lREACT per ETH** (0.05 → 5.25 lREACT, tx `0x949c2ca1…4b82`).
  - The native OP-stack bridge `L1StandardBridgeProxy 0xea58fcA6849d79EAd1f26608855c2D6407d54Ce2` (superchain-registry `superchain/configs/sepolia/unichain.toml`) moved 0.015 Sepolia ETH to Unichain Sepolia in **89 s** via `depositETH(uint32 200000, bytes 0x)`.
  - The Superchain faucet gives **0.01 ETH/24 h** without on-chain identity.
- **lREACT faucet caps differ from the docs.** The docs say "max 5 ETH per tx". On-chain `max_payout()` (2026-11-06) is **1 ETH on Base Sepolia** (`0x2afa…5967`) and **50 ETH on Ethereum Sepolia** (`0x9b9B…f434`). `_request` pays `min(value, max_payout)` and **keeps the excess**. Both expose `request(address receiver)` payable (selector `0x27c78c42` present in both bytecodes). Source: Reactive-Network/testnet-faucet `ReactiveFaucetL1.sol`.
- **Gas prices (2026-11-06):** Unichain Sepolia 0.0015 gwei, Base Sepolia 0.006 gwei, Lasna 100 gwei. Pool-chain deploys cost almost nothing, so ETH is mostly needed to fund callback contracts. lREACT goes on Lasna deploys (~0.1 lREACT) and contract funding.
- **v4 position custody, as the deployed PositionManager behaves** (fork of Unichain Sepolia block 67121755, E-004):
  - An address that's merely `approve`d for a tokenId can run `DECREASE_LIQUIDITY` + `TAKE_PAIR`, and the owner keeps the NFT.
  - Approval dies when the owner moves the NFT.
  - `transferFrom` **clears any subscriber**.
  - A subscribed position calls its subscriber on every liquidity change, which is arbitrary code that can revert or burn gas, so exits refuse `hasSubscriber()` positions.
- **Exit gas on-chain (E-006):** `exit()` used 140,003 gas inside a callback tx that used 183,138 in total (gas limit 1,000,000). On-chain it beats the fork figure below, which included test-harness call overhead.
- **Exit gas:** a full exit (decrease all liquidity + take both tokens to a recipient) costs ~196.5k gas including call overhead. Request 1,000,000 per callback, so there's headroom for ERC20s with costly transfers. Measured on a fresh 0.3% pool with ticks ±600.
- **Public RPC log range.** `https://sepolia.unichain.org` rejects `eth_getLogs` over **1000 blocks** ("block range greater than 1000 max", 2026-11-06). Poll from the block at send time. On Base Sepolia, 1000 blocks is only ~200 s.
- **`cast logs --json` (1.8.3).** Success prints a plain JSON array. An RPC error exits 1 but still prints an error *envelope object* (`{"schema_version":1,"success":false,...}`) on stdout. Check both the exit code and `type == "array"` (`script/spike/s1-run.sh` `wait_log`, all three paths exercised against live RPCs 2026-11-06).
- **`cast compute-address` (1.8.3)** prints just the address, with no "Computed Address:" prefix.
- **macOS `seq`** prints large numbers in scientific notation (`6.71213e+07`). Never use it for block numbers. macOS `/bin/bash` is 3.2, where `source <(...)` silently loads nothing.
- **Injected callback sender is unverified.** The docs say Reactive writes the *requesting reactive contract's* address into the payload's first argument (legacy wrote the RVM ID, i.e. the deployer). Spike S1's `PongSink` records what actually arrives (`injectedSenderMatches`) instead of reverting. Ripcord's vault must enforce `onlyCallbackSender` with whatever S1 shows.
- **Another entrant's vault doesn't check the injected sender** (emilhuseyn/reactive-omni sets `address(0)` and checks only `onlyServiceProvider`), so any Lasna reactive contract could trigger it via the proxy. Ripcord checks both the proxy and the sender: that's our reversal beat.
- **Omni's `IReactive` still declares the legacy `event Callback(...)`.** It's deprecated: request callbacks with `SYSTEM.requestCallbackV_1_0`, never by emitting it. (reactive-lib-omni v0.1.0 `interfaces/IReactive.sol`)
- **Remappings.** `@uniswap/v4-core/` points into `lib/v4-periphery/lib/v4-core/`. Installing v4-core separately would create two copies (D-006). Run `git submodule update --init --recursive` after cloning.
- **Legacy vs Omni.** Reactive's `reactive-smart-contract-demos` (pushed 2026-10-07) still imports legacy `reactive-lib`. Its stop-order demos use `vm`, `emit Callback` and `REACTIVE_CHAIN_ID = 1597` mislabelled as Lasna. Don't copy from them. (source: repo read 2026-11-06)
- **`reactive-test-lib` is legacy-shaped.** Its README etches its mock at `SERVICE_ADDR 0x…fffFfF` and targets `reactive-lib` v0.2.0+. Unverified against Omni's `0x8888…`. (D-004)
- **Pragma conflict.** v4 `PoolManager.sol` and `PositionManager.sol` pin `pragma solidity 0.8.26` exactly, while reactive-lib-omni needs `^0.8.29`. Import only v4 **interfaces and libraries**, which use `^0.8.0` or `^0.8.24` and are safe. Never import the concrete v4 contracts in one unit with our sources. Fork-test against live deployments instead. (pragma lookups via GitHub API, 2026-11-06)
- **`forge lint` exit code.** Bare `forge lint` exits 0 even with warnings. `--deny warnings` exits 1. Verified on forge 1.8.3 with an unchecked ERC20 `transfer`, 2026-11-06.
- **Base Sepolia timers.** 200 ms blocks: use timestamps, never block counts. (event ground rule; block time [E-001])
- **Cron on Omni is unknown.** The cron topics are documented only against the legacy `0x…fffFfF`. That address has bytecode on Lasna (research, 2026-11-06), but cron delivery on Omni is unverified. Ripcord's design doesn't need cron.
- **Faucet gating (reported).** Another entrant found Base Sepolia public faucets gated on a mainnet ETH balance.
- **Callback proxy bytecode is small (~220 bytes),** so it's a proxy. Read fee parameters on-chain, not from docs.
- **Vercel's Node ceiling is 24.x (2026-11-06).** `vercel build` rejects `"engines": { "node": ">=26" }` with "Found invalid or discontinued Node.js Version", even locally. The web deploy is prebuilt instead (D-015, `web/scripts/deploy-vercel.sh`).
- **Vercel Authentication covers deployment URLs, not the production domain.** New projects get `ssoProtection: { deploymentType: "all_except_custom_domains" }`: every `ripcord-<hash>-emmanuel-pauls-projects.vercel.app` URL answers 302 → `vercel.com/sso-api`, but the production domain **`ripcord-ashy.vercel.app` is public** (200 logged-out, 2026-11-06). Test the production domain, not a deployment URL.
- **`vercel link` also connects the GitHub repo.** Every push to `main` then triggers a Vercel build from the repo root, which fails (`vite: command not found`, no root directory, and Node 26 is above Vercel's ceiling). Production is unaffected (failed builds are never promoted), but each push adds an Error deployment. Fixed 2026-11-06: the user removed the Git connection (dashboard → Settings → Git → Disconnect). Deploys stay manual from `web/` per D-015. If the project is ever re-linked, check Settings → Git again.
- **`ripcord.vercel.app` belongs to someone else** (HTTP 500 from another project, 2026-11-06). Our production domain is `ripcord-ashy.vercel.app`.
- **Reactive charges never show on a receipt.** A Lasna reaction's receipt has `effectiveGasPrice` 0; the lREACT charge appears only as the reactive contract's balance drop inside that block. Per loop for RipcordReactive: the arm's tracking reaction (~0.0209 lREACT) plus the firing reaction (~0.0152). The vault's callback costs ~4.5e-7 ETH on Unichain. Both RPCs serve historical balances (`--block`), which is how `web/src/chain/funding.ts` prices an exit.
- **A loop can sit half inside the web's live window.** The first poll scans the last 900 blocks on each chain, and the two windows don't cover the same events: a loop's Lasna reaction can be inside Lasna's window while its arm and exit on Unichain are older than Unichain's. Building a position from those logs alone shows defaults as chain data (seen 2026-11-06: #7952 rendered "line 0, at or below, BOARDING"). The poll now starts any unseen position from the vault's `lines(tokenId)` storage at the same head, and history and live records merge field by field (`mergeRecords`), never replace.

## Environment
| Var | Purpose | Where to get it |
|---|---|---|
| `LASNA_RPC` | Reactive Lasna RPC | https://lasna-rpc.rnk.dev/ |
| `UNICHAIN_SEPOLIA_RPC` | pool-chain RPC and fork tests | https://sepolia.unichain.org (public) |
| `BASE_SEPOLIA_RPC` | pool-chain RPC and fork tests | https://sepolia.base.org (public) |
| `SEPOLIA_RPC` | lREACT faucet on Ethereum Sepolia | any Sepolia RPC provider |
| `DEPLOYER_ADDRESS` | the project wallet `0x08e768752cA0F8a132cB82cB4bB4354470DD9111` (D-007) | public address, safe to show |
| `ACCOUNT` | Foundry keystore name: `ripcord-deployer` | `~/.foundry/keystores/ripcord-deployer` (encrypted, mode 600) |
| `KEYSTORE_PASSWORD_FILE` | unlocks the keystore without a prompt | `~/.foundry/ripcord-deployer.password` (mode 600, outside the repo). Never commit it, print it, or show it on screen |

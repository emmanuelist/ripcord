<p align="center">
  <img src="docs/readme/cover.png" alt="Ripcord's live page: the claim beside position #7954, DEPARTED, its swap, Lasna reaction and exit hashed, 2 blocks from swap to exit" width="100%">
</p>

# Ripcord

### Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.

[![ci](https://github.com/emmanuelist/ripcord/actions/workflows/ci.yml/badge.svg)](https://github.com/emmanuelist/ripcord/actions/workflows/ci.yml) [![tests](https://img.shields.io/badge/tests-110%20passing-3fbf7f)](https://github.com/emmanuelist/ripcord/actions/workflows/ci.yml) [![testnet](https://img.shields.io/badge/testnet-Unichain%20Sepolia%20%2B%20Reactive%20Lasna-f2c230)](#limits) [![live](https://img.shields.io/badge/live-ripcord--ashy.vercel.app-16171a)](https://ripcord-ashy.vercel.app)

**[Live app](https://ripcord-ashy.vercel.app)** · **[Proof](#proof-nothing-here-is-a-mockup)** · **[Verify it yourself](#verify-without-trusting-this-readme)** · **[How it works](#how-it-works)** · **[Limits](#limits)** · **[Run it locally](#run-it-locally)**

Measured on testnet: 11 of 11 real loops exited 2 or 3 Unichain blocks after the crossing swap, 2–3 s on Unichain's own clock.

## The problem

A Uniswap v4 position earns only while the price stays in its range. When the price runs through, an LP wants out at a level they chose, the way a stop works on an exchange. But v4 has no native stop: removing liquidity is a transaction somebody has to send. So the usual answer is a keeper, a bot or a server or an open tab that watches the pool and holds a key, and the position is only as safe as that machine's uptime.

Ripcord removes the keeper. The owner approves a vault on their position NFT and arms a line once. A Reactive contract on Reactive Lasna subscribes to that pool's `Swap` events, compares every new tick with the armed lines, and when one is crossed asks Reactive to call the vault back on Unichain. The vault removes all of the position's liquidity and sends both tokens to whoever holds the NFT. After arming, nothing the owner runs takes part. Take Reactive's event subscription and cross-chain callback away and the keeper comes back: that is the part this needs Reactive for.

## Proof: nothing here is a mockup

Everything below is live on testnet now. Click it.

- **The app:** [ripcord-ashy.vercel.app](https://ripcord-ashy.vercel.app). It has no backend: every value is read from Unichain Sepolia and Lasna in your browser, from the transactions listed below and from live polling.
- **The contracts:** [RipcordVault](https://sepolia.uniscan.xyz/address/0x641413bb227c5452ef2b968c9774bc31f5f54c98) on Unichain Sepolia and [RipcordReactive](https://lasna.reactscan.net/address/0xA2deA4D676236Aa905c0Cb1B90712Fc3591af2B5) on Reactive Lasna.
- **Every claim, with its proof:** [`docs/EVIDENCE.md`](docs/EVIDENCE.md) has a row for every factual sentence on the page and in this README, and the raw receipts are in [`docs/evidence/`](docs/evidence/).

### Eleven real loops

A real swap crosses an armed line, RipcordReactive reacts on Lasna, and the vault exits on Unichain. Blocks and seconds are counted from the crossing swap's block to the exit's block, on Unichain's clock.

| Position | Swap (Unichain) | Reaction (Lasna) | Exit (Unichain) | Swap → exit |
|---|---|---|---|---|
| #7944 | [0x88de…1262](https://sepolia.uniscan.xyz/tx/0x88dea6df04ee3a74b8b0020a6dc3a5f796930fca73559c74037f5ed6a2031262) | [0x8636…f892](https://lasna.reactscan.net/tx/0x86364e500098f45f4a3a854db410345a85201109ac33975afe27e896fe0af892) | [0x31a5…b119](https://sepolia.uniscan.xyz/tx/0x31a5b83cba4bb5ee28bdadd8b6d4ee8e60a0193443434515754286d09657b119) | 2 blocks, 2 s |
| #7945 | [0x82f6…e790](https://sepolia.uniscan.xyz/tx/0x82f67bb74643666ffc105e3626371b6af0906ec09fefdb6f83df64e300f7e790) | [0x5784…dfc6](https://lasna.reactscan.net/tx/0x5784fc4a5a0375750f9ced2df8cdd7cbed79cafef2811d427ca350eeb00cdfc6) | [0x614a…ab72](https://sepolia.uniscan.xyz/tx/0x614a6de33ad8b7cb66b6535481cddda1d8459463e7ce556b8c770f3e434fab72) | 3 blocks, 3 s |
| #7946 | [0x7195…c7af](https://sepolia.uniscan.xyz/tx/0x7195deb7990ca9425ff6c03ce345223bc9b67b3525c763a5dddb05bb5befc7af) | [0xc6ae…942c](https://lasna.reactscan.net/tx/0xc6aeaa32b8673489716ea6212bb89f9b5c97bc764c92d3493a8803a4a390942c) | [0x330e…c18b](https://sepolia.uniscan.xyz/tx/0x330ee41f74ec34dff8f759437eea34a9f4327f976bdab42901c85c95e274c18b) | 3 blocks, 3 s |
| #7947 | [0x97da…9188](https://sepolia.uniscan.xyz/tx/0x97da54b9cb8dc11396eeb5494560c7873ce3d6aeca3a293017a77e359bc99188) | [0xefeb…c891](https://lasna.reactscan.net/tx/0xefebbac656d9eef06519bff44f408f1aa04708fcf7adcc5d5e4c3ff9b0a1c891) | [0x7fbd…410d](https://sepolia.uniscan.xyz/tx/0x7fbd296f1992d444a23241e79d925a6840ea178c31370b4fcfb6a7f14775410d) | 2 blocks, 2 s |
| #7948 | [0x9c90…be1b](https://sepolia.uniscan.xyz/tx/0x9c904be64d98c01d905789652018ba9c6148ea59492b6c5a38fe280ac183be1b) | [0xc90f…5b7e](https://lasna.reactscan.net/tx/0xc90f5d6fcdfeb8491dd92162d9f4b09d5c592412e08f3dc914ef822bc8f45b7e) | [0x796e…adda](https://sepolia.uniscan.xyz/tx/0x796e38e0ca23867b4246248410ec0c9b4b687e379e519568f17c88f00817adda) | 3 blocks, 3 s |
| #7949 | [0xb62a…b954](https://sepolia.uniscan.xyz/tx/0xb62a1d5c5ba63f2e41dc7c4c7bb3e1dbe6ce06015d9f44caa75c04332335b954) | [0x573f…0db4](https://lasna.reactscan.net/tx/0x573f3897bb0e1c627c93512315fede799e809690f7d31b0f5bd0a6a7c9ec0db4) | [0x269b…f20a](https://sepolia.uniscan.xyz/tx/0x269bb1d39841de0147000732fa874ad939bfaab019f7cec3c7ffe1d5880ff20a) | 2 blocks, 2 s |
| #7950 | [0xe8e9…ecef](https://sepolia.uniscan.xyz/tx/0xe8e9f268123987982c182f13ece7adafb607970f23730ae5dd28a76455f1ecef) | [0x5726…5e72](https://lasna.reactscan.net/tx/0x5726d691943a4d70fe2dc206e336ad70334aabacc7a1a6cb91ea88a8e98b5e72) | [0xa7b3…ddbb](https://sepolia.uniscan.xyz/tx/0xa7b3546571d802fadd0f96a2e2f247003563e39108f02c60b406355fd650ddbb) | 2 blocks, 2 s |
| #7951 | [0xfea8…6fe8](https://sepolia.uniscan.xyz/tx/0xfea83c8d8405e38155f0135f05170ed56b7af2a0083aea6006577e01b12d6fe8) | [0xac3e…1fef](https://lasna.reactscan.net/tx/0xac3ed6f9ca00f6e28c1590434b95f576f0b14dd86ebb73658e19b04cb53d1fef) | [0x7852…7ea7](https://sepolia.uniscan.xyz/tx/0x7852e39110657649848d9f843ade6fb652f39f95e8971b36471da1c28fc97ea7) | 2 blocks, 2 s |
| #7952 | [0x1f52…7274](https://sepolia.uniscan.xyz/tx/0x1f526048b56e79e33cc8d4df759e0f86d0b26ae42077e5a5da5e230db1857274) | [0xd803…0c2c](https://lasna.reactscan.net/tx/0xd80364cf0316a68612a2c57b9d62d3c9c0593ae189b8752e3178a89c4bd30c2c) | [0x2922…f23f](https://sepolia.uniscan.xyz/tx/0x292239a93d1dc3f44535eba5e7ab3a99f804e3619747b585a8eb09c8bccbf23f) | 2 blocks, 2 s |
| #7953 | [0x73a3…54cb](https://sepolia.uniscan.xyz/tx/0x73a3edaf925988341ff1c6cb801ff3ed5e26c56b9283c853e41177bcec8f54cb) | [0xd883…a0ea](https://lasna.reactscan.net/tx/0xd88339550bb1826d19543e27dd802278b1f53268cd38acff58e3d0158c94a0ea) | [0x53fd…144e](https://sepolia.uniscan.xyz/tx/0x53fdc8a901e3ab348ac220480e5f44fb28f5a8ed65be3e95e34fc39c38f7144e) | 2 blocks, 2 s |
| #7954 | [0xd1f6…01c5](https://sepolia.uniscan.xyz/tx/0xd1f642dac67acb1a3f0f91e9722e9ee83bf200ffa758a196527ede5480f901c5) | [0x04aa…6415](https://lasna.reactscan.net/tx/0x04aa39b4888f4f55b28a31128ef366c14a16b3ca32900050ddc8497480d56415) | [0x31b4…2337](https://sepolia.uniscan.xyz/tx/0x31b4fbf0a260b7fd0f483bd45e51cce8bc126f9830ffa6efdc5d92f18d922337) | 2 blocks, 2 s |

Swap to exit: **2 blocks in 8 loops, 3 blocks in 3** (median 2, max 3). Sources: [E-012](docs/evidence/E-012-ten-loops-2026-11-06.md), [E-013](docs/evidence/E-013-v3-live-run-7954-2026-11-06.md).

### Three things it refuses

<p align="center"><img src="docs/readme/refusals.png" alt="The page's refusal room: a swap that stops short of the line (held), an exit called by the wrong sender (reverted), an exit after approval was revoked (cancelled)" width="100%"></p>

| Attempt | What the chain did | Transactions |
|---|---|---|
| **A swap that stops short of the line.** #7955's line sat at −2134; a swap moved the tick −934 → −1124. | RipcordReactive reacted on Lasna and was billed 0.0119 lREACT, but requested no callback. #7955 kept all its liquidity. | swap [0x6b67…937a](https://sepolia.uniscan.xyz/tx/0x6b67894a7ef208e2b35d4d8a6a648d29985c6831654ab3182cd8dc12767a937a) · reaction [0xb526…0421](https://lasna.reactscan.net/tx/0xb52659bef2c5b0d4c77bbca45b86e538ef5a328c2cebe62de9e3991feed70421) |
| **An exit called by anyone but Reactive.** The project wallet called `RipcordVault.exit` on #7955 itself, posing as RipcordReactive. | Reverted: `NotAuthorized(wallet, callbackProxy)`. Only Reactive's callback proxy may call `exit`. The owner then disarmed the line. | [0x6f57…52ad](https://sepolia.uniscan.xyz/tx/0x6f5761d4658392c7e01f248fe220ad29268ff4ccfd0f90fd876796476f3052ad) · disarm [0x03ce…a027](https://sepolia.uniscan.xyz/tx/0x03ce4525b8feb1c92312d8ffc0721d3633fd08919c52490e9412a3dc0a27a027) |
| **An exit after the owner revoked approval.** Then a swap crossed #7956's line at −1184 (−1124 → −1218). | Lasna pulled the ripcord; the vault could not touch the NFT and recorded `ExitFailed` with `NotApproved(RipcordVault)`, 2 blocks after the swap. #7956 kept all its liquidity. | revoke [0x0fd1…f863](https://sepolia.uniscan.xyz/tx/0x0fd10c2fdf031cc227f8cb99ecce48daaf905f25c8878e822cd470e9882cf863) · swap [0xfd32…7cfa](https://sepolia.uniscan.xyz/tx/0xfd32a7451b55f6e787df5e9018e685a50c95cc707442e88843dd89e6cf127cfa) · pull [0xb84a…b1aa](https://lasna.reactscan.net/tx/0xb84a9ef26dd7d3226bb193ccbb64b262640e52ed8df151023b1ad3509afab1aa) · refusal [0x2fb3…5a8f](https://sepolia.uniscan.xyz/tx/0x2fb3cc41eda9f5fa7080603d6fb7b6292ad17979b3fe63b4354409b2c9cb5a8f) |

Source: [E-016](docs/evidence/E-016-refusals-2026-11-06.md), with all 16 raw receipts in [`docs/evidence/m2/receipts/`](docs/evidence/m2/receipts/).

## Verify without trusting this README

Read-only checks against the live contracts. They need [Foundry's `cast`](https://getfoundry.sh) and nothing else: no wallet, no keys.

```bash
RPC=https://sepolia.unichain.org
VAULT=0x641413bb227c5452ef2b968c9774bc31f5f54c98

# 1. #7954's line is spent: the last field is the vault status, 2 = Exited
cast call --rpc-url $RPC $VAULT "lines(uint256)(address,bytes32,int24,bool,uint8)" 7954

# 2. Its swap and its exit are 2 blocks and 2 seconds apart
cast receipt --rpc-url $RPC 0xd1f642dac67acb1a3f0f91e9722e9ee83bf200ffa758a196527ede5480f901c5 blockNumber   # 67142695
cast receipt --rpc-url $RPC 0x31b4fbf0a260b7fd0f483bd45e51cce8bc126f9830ffa6efdc5d92f18d922337 blockNumber   # 67142697
cast block --rpc-url $RPC 67142695 -f timestamp; cast block --rpc-url $RPC 67142697 -f timestamp

# 3. Anyone calling exit() directly is refused: the error is NotAuthorized(yourAddress, callbackProxy)
cast call --rpc-url $RPC --from 0x000000000000000000000000000000000000dEaD $VAULT \
  "exit(address,uint256,int24,uint256,uint256)" 0xA2deA4D676236Aa905c0Cb1B90712Fc3591af2B5 7954 -1000 0 0
cast 4byte-decode <the revert data it prints>

# 4. The position whose exit was refused still holds all its liquidity (1e21)
cast call --rpc-url $RPC 0xf969Aee60879C54bAAed9F3eD26147Db216Fd664 "getPositionLiquidity(uint256)(uint128)" 7956
```

And the test suites from a clean clone:

```bash
git clone --recursive https://github.com/emmanuelist/ripcord && cd ripcord
(cd contracts && forge test)              # 75 tests; the fork tests read live Unichain Sepolia over its public RPC, no keys
(cd harness && npm ci && npm test)        # 14 tests, no network
(cd web && npm ci && npm test)            # 21 tests, no network, including decoding #7944's real receipts
```

## How it works

```mermaid
flowchart LR
  subgraph U1[Unichain Sepolia]
    S[PoolManager emits Swap<br/>poolId, tick]
  end
  subgraph L[Reactive Lasna]
    R[RipcordReactive.react<br/>crossed an armed line?]
  end
  subgraph U2[Unichain Sepolia]
    P[Reactive callback proxy] --> V[RipcordVault.exit<br/>DECREASE_LIQUIDITY + TAKE_PAIR]
  end
  S -- subscribed Swap topic --> R
  R -- requestCallbackV_1_0 --> P
```

1. **Arm.** The owner approves RipcordVault on their position NFT and calls [`arm(tokenId, triggerTick, exitBelow)`](contracts/src/RipcordVault.sol#L118). The vault emits `LineArmed`, which RipcordReactive follows, and it subscribes to that pool's `Swap` topic when the pool's first line arrives ([RipcordReactive.sol:109](contracts/src/RipcordReactive.sol#L109)).
2. **React.** While a line is armed, every swap in its pool reaches [`react()`](contracts/src/RipcordReactive.sol#L61) on Lasna. It checks each armed line ([:137](contracts/src/RipcordReactive.sol#L137)) and, for each one crossed, calls [`requestCallbackV_1_0`](contracts/src/RipcordReactive.sol#L159).
3. **Exit.** Reactive's callback proxy calls the vault. [`exit`](contracts/src/RipcordVault.sol#L165) accepts only the proxy, carrying RipcordReactive as its injected sender, re-checks the crossing, then removes all liquidity with one `modifyLiquidities` call ([:220](contracts/src/RipcordVault.sol#L220)). If the exit can't happen (approval revoked, NFT moved, a subscriber added), the failure is caught and recorded as `ExitFailed` with its reason ([:197](contracts/src/RipcordVault.sol#L197)) instead of vanishing.

Custody stays with the owner throughout: the vault is only approved, the NFT never moves, and both tokens go to its holder.

Built on [reactive-lib-omni](https://github.com/Reactive-Network/reactive-lib-omni) v0.1.0 (Reactive Omni: `0x8888…8888` system contract, `requestCallbackV_1_0`), Uniswap v4-periphery at `c6e4754` with v4-core 1.0.2, Solidity 0.8.38, Foundry 1.8.3. The web page is Vite + React + viem, static, with no server.

## Limits

- **Testnet only**, on Unichain Sepolia and Reactive Lasna. The contracts are not audited.
- **3 seconds is a measurement, not a guarantee.** It is 11 loops on testnet, timed on Unichain's own clock. A viewer watching through public RPCs first saw each exit 2–6 s after the swap was mined, a range that is mostly polling.
- **The exit lands after the crossing swap, not at your price.** One large swap can carry the price well past the line, and the exit removes liquidity at whatever price it finds. It never swaps.
- **At most 8 armed lines per pool**, so a single swap can't push one reaction past Lasna's gas cap.
- **No funding, no exit.** RipcordReactive pays for reactions in lREACT and the vault pays for callbacks in ETH. While a line is armed, every swap in its pool bills a reaction. The page shows how many exits each balance still covers.
- **The demo pool is ours.** It pairs RDA and RDB, test tokens the project wallet deployed, and every loop above was driven by this repo's harness from that wallet.
- **The page reads public RPCs.** It shows the recorded positions and anything that happens while it is open.

## Run it locally

You need Foundry 1.8.3 and Node 26.

From the repo root:

```bash
cp .env.example .env                          # RPC URLs, the deployer address, a Foundry keystore account (no keys in .env)
(cd web && npm ci && npm run dev)             # the page, reading the deployed contracts
(cd harness && npm ci && npm run measure)     # one real loop end to end (needs a funded keystore wallet)
(cd harness && npm run reversals)             # the three refusals (same)
```

Deployment scripts are in `contracts/script/`; the deployed addresses are in [`docs/evidence/m1/deploy.json`](docs/evidence/m1/deploy.json).

## Repo

| | |
|---|---|
| `contracts/` | RipcordVault, RipcordReactive, the spikes, Foundry tests (unit and live-v4 fork) |
| `harness/` | the latency harness (`measure`) and the refusals (`reversals`), TypeScript + viem |
| `web/` | the read-only page |
| `docs/` | [state](docs/STATE.md), [plan](docs/PLAN.md), [decisions](docs/DECISIONS.md), [evidence and claims](docs/EVIDENCE.md), [dependency facts](docs/CONTEXT.md), [design](DESIGN.md) |

Built for the Reactive Omni Buildathon, Every Second Counts track.

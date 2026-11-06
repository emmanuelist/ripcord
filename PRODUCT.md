# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack
Delegated (the user chose "whichever does the best job" between Vite + React and Next.js). The choice: **Vite + React + TypeScript + viem**, as a static build on Vercel (account `emmanuelist`, D-013). Reasons (D-014):
- Both public RPCs allow browser CORS (verified 2026-11-06), so no server is needed to read the chain.
- It reuses the harness's pinned TypeScript 6.0.3 and viem 2.57.16, and its ABI definitions.
- History is fetched by transaction hash, which has no block-range limit; live updates come from polling new blocks.

## Users
Two audiences, weighted equally (user, 2026-11-06):
- **Judges and link-clickers.** The Reactive team reviews a Reactive Omni Buildathon entry, mostly through a video under 3 minutes, plus anyone who opens the link. Their job is to see that the claim is true and check it on-chain in one click.
- **Uniswap v4 liquidity providers** deciding whether to protect a position with Ripcord. They need to understand what Ripcord does, what it costs them (an approval, not custody), and what it won't do.

The page is **read-only** for now: no wallet connection (D-005, D-007). Positions are armed by the project's scripts.

## Product Purpose
Ripcord pulls a Uniswap v4 position's liquidity the moment the pool's price crosses a line the owner chose, with nothing of the owner's running. A Reactive contract on Reactive Lasna watches the pool's swaps and triggers the exit through a cross-chain callback.

Thesis (C-1, **unverified** until N is measured over ≥10 runs): "Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running."

Success for this page: a judge watching the video sees a real swap cross a real line and the position leave the pool seconds later, and can open every transaction behind it. An LP understands the mechanism, the custody model and the limits.

## Positioning
- The trigger is the pool's own `Swap` event, so there's no polling gap: an AMM price only moves through swaps, and every swap reaches the reactive contract.
- The reaction runs on Reactive Omni (~1 s blocks), so it lands about 2–3 Unichain blocks after the crossing swap, measured on-chain (E-009, E-010).
- The exit races the market, not searchers: nobody else profits from executing your exit.
- The owner keeps the NFT and only approves the vault (D-010).
- Each exit event records the triggering swap's block and transaction hash, so every exit is traceable to its cause on-chain.

## Operating Context
- Chains: Unichain Sepolia (the pool and the vault) and Reactive Lasna (the reactive contract). Testnets only.
- Judges watch the video, then may open the page, a block explorer (sepolia.uniscan.xyz, lasna.reactscan.net) and the GitHub repo.
- The demo pool uses disclosed test tokens (RDA/RDB), because testnet v4 pools have no organic liquidity.
- Demo runs come from `contracts/script/demo-loop.sh` and the latency harness `harness/`.

## Capabilities and Constraints
**Live on-chain** (docs/STATE.md):
- RipcordVault (`arm` / `disarm` / `exit`, approve custody).
- RipcordReactive (subscribes per pool, fires each crossed line once).
- Demo pool `0xcd85…d064`. Addresses are in `docs/evidence/m1/deploy.json`.

**Line statuses:** None, Armed, Exited, Failed, Disarmed. UI-derived states: "approval missing" (armed, but the vault isn't approved any more) and "pulled" (the reactive tx is seen, the exit isn't yet).

**Limits that must be stated, not hidden:**
- Testnet only, no audit.
- At most 8 lines per pool (D-012).
- One large swap can blow past the line: the claim is "within N seconds of crossing", not "at your price".
- An unfunded reactive contract or vault means no exit.
- Exits remove liquidity only and don't swap to one asset.

**Data constraints:**
- Public Unichain RPC caps `eth_getLogs` at 1,000 blocks, so history comes from known transaction hashes and live data from new-block polling.
- Public-RPC visibility trails block inclusion. **Latency is quoted from on-chain block deltas.** Wall-clock figures are "what a UI sees".

**Undecided:** the final value of N (needs ≥10 runs), and whether a later version adds wallet connection so LPs can arm lines themselves.

## Brand Commitments
- The name is **Ripcord**.
- The thesis sentence must be used verbatim across the README, the page, the form and the video once it's verified. Until then the page must not state N.
- No other brand assets exist yet.

## Evidence on Hand
- On-chain loops with every receipt:
  - E-009: tokenId 7944, swap → exit in 2 Unichain blocks / 2 s.
  - E-010: tokenId 7945, 3 blocks / 3 s, with bounded wall clock.
- Raw JSON for both: `docs/evidence/m1/loop-7944.json` and `docs/evidence/harness/run-7945.json`.
- The latency spike, 5/5 loops: E-005.
- Fork and unit tests: E-008.
- Full claims and proofs index: `docs/EVIDENCE.md`.

**Absent, and must not be fabricated:**
- users, TVL, volume
- testimonials or partners
- mainnet deployments or audits
- any N figure before C-1 is verified

## Product Principles
1. **Proof over polish.** Every value on screen is read from chain and links to its transaction. No mocks, no demo mode.
2. **Say the limits out loud.** Testnet, the 8-line cap, blow-through on big swaps, approvals that can die: stated where the user would hit them.
3. **Latency is measured, not asserted.** Seconds come from block deltas the visitor can check, never from a stopwatch we control.
4. **Nothing of yours running.** The interface never implies the user must keep a tab, bot or server alive.

## Accessibility & Inclusion
No product-specific requirement was established. Default to WCAG 2.2 AA. Status must never be conveyed by colour alone, because "armed", "pulled", "exited" and "failed" have to be distinguishable in a video and for colour-blind viewers.

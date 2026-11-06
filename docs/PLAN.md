# Plan
Build window: 2026-11-04 12:00 UTC → 2026-12-05 20:00 UTC
Started: 2026-11-06 11:00 UTC

- **Deadline source:** DoraHacks page JSON `timelineEnd` 1796500800, shown on the page as "2026/12/05 21:00 (UTC+1)" (captured 2026-11-06 in `internal/research/raw/`).
- **Buffer:** 10% of the window, at least 2 hours and at most 24. Here that's 24 h.
- **Freeze:** 80% of the window, or 48 hours before the deadline, whichever is later.
- Checkpoints count from `Started:`.

| # | Milestone | When | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|---|
| M0 | Rigged | 10% | D-001 recorded. Contracts gate green locally and in CI. Spike S1 (Omni hello loop on the pool chain) and spike S2 (callback-driven liquidity decrease) each passed with tx hashes and raw receipts in docs/evidence/. Pool chain chosen by measurement (DECISIONS) | 2026-11-09 09:30 UTC | in progress |
| M1 | Walking skeleton | 40% | One real loop through every layer, deployed: a user registers a line on a real v4 position, a real swap crosses it, Lasna reacts, and the vault pulls the liquidity. The hosted frontend shows that position's state read from chain, and the harness records the loop's three hashes and per-hop times | 2026-11-18 05:00 UTC | |
| M2 | Core claim | 65% | Thesis demonstrated end to end, N measured over ≥10 runs (median and p90). **Reversal beat:** a direct call to the vault's exit from any address other than the Reactive callback path reverts on-chain, and a swap that doesn't cross the line leaves the position untouched. Both have tx hashes | 2026-11-25 13:15 UTC | |
| M3 | Proof surface | freeze | README proof section. Every public claim has a verified row in docs/EVIDENCE.md. Video under 3 min recorded (docs/VIDEO.md). `benchmark` run and its fixes landed | 2026-12-03 20:00 UTC | |
| M4 | Submitted | deadline − buffer | DoraHacks form submitted with the verbatim thesis, contract addresses, loop hashes and the latency answer. Preflight passed from a phone on cellular. Submission commit tagged | 2026-12-04 20:00 UTC | |

**Kill criteria (D-001), decide by 2026-11-13:**
- (a) Loop median over 5 s.
- (b) A liquidity decrease can't run from a callback within the gas limit.
- (c) A visible entrant ships a v4 LP range-exit on Omni.

On (a) or (b), re-open research for this track.

## Work items (sprint profile)
### M0 · Rigged
- [ ] **ops: testnet funds** (owner: user, by 2026-11-07). Get ETH on Unichain Sepolia and/or Base Sepolia, plus lREACT on Lasna via a faucet: Ethereum Sepolia `0x9b9B…f434` or Base Sepolia `0x2afa…5967`, 1 ETH → 100 lREACT, max 5 ETH per tx. Done when `cast balance` shows non-zero on Lasna and the pool chain for the deployer address.
- [ ] **Contracts scaffold.** Foundry in `contracts/` with libs pinned per AGENTS.md (reactive-lib-omni v0.1.0, forge-std v1.17.0, v4-core v4.0.0, v4-periphery at a recorded commit), solc 0.8.38, evm cancun. Done when the four gate commands exit 0, with output in the commit message.
- [ ] **CI.** `.github/workflows/ci.yml` runs the contracts gate. Done when the first push shows a green run (needs the GitHub repo; ask about visibility first).
- [ ] **Spike S1: Omni hello loop.** A minimal reactive contract on Lasna subscribes to a `Ping` event on the pool chain and calls back a `Pong` receiver on the same chain. Run it 5× on Unichain Sepolia, and 5× on Base Sepolia if funds allow. Done when 5 hash triples (origin, Lasna, callback) are saved with raw receipts, plus the median latency per chain. This also proves Lasna accepts cancun bytecode from solc 0.8.38.
- [ ] **Spike S2: callback-driven exit.** On the chosen chain, a callback contract that owns a v4 position NFT runs `modifyLiquidities` with DECREASE_LIQUIDITY + TAKE_PAIR when called through the callback proxy. Done when there's a tx hash showing the liquidity drop to 0 and the gas used is recorded against the callback gas limit.
- [ ] **Decide the pool chain** from the S1 numbers and funding reality, and record it in DECISIONS.

### M1 · Walking skeleton
- [ ] Placeholder. Detail it when M0 closes.

### M2 · Core claim
- [ ] Placeholder. Includes the "what one second buys" source: a real mainnet crash price series (research needed).

### M3 · Proof surface
- [ ] Placeholder.

### M4 · Submitted
- [ ] Placeholder.

## Cut list
Things deliberately not being built. Each entry links the DECISIONS entry that cut it.
- Cross-chain price-sync fee hook (C1): D-001

# Decisions
Append-only. To change a decision, add a new entry that supersedes it.

## D-001 · Build Ripcord for Every Second Counts · 2026-11-06 · accepted
**Context:** The Reactive Omni Buildathon allows one track per project (`isMultiTracksAllowed: false`).

**Decision:** Build **Ripcord**, a Uniswap v4 LP range-exit. A Reactive contract on Lasna watches the pool's `Swap` events. When the price crosses the user's line, a callback to a vault that holds the position NFT removes the liquidity. The track is Every Second Counts ($2,000 first / $250 runner-up, paid in REACT).
- **Thesis:** "Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running."
- **Why it holds:** an exit races the *market*, not searchers, because nobody else profits from executing it. An AMM price only moves through swaps, and every swap emits the subscribed event, so there's no polling gap.

**Alternatives:**
- **C1, a cross-chain price-sync dynamic-fee hook (Base → Lasna → Unichain).** Rejected by the thesis break test. On major pairs a searcher holding inventory on both chains closes the gap within about one block, before the callback lands. On long-tail pairs the gap lasts minutes, so legacy timing would serve equally well. It fails either Usefulness or "needs Omni".
- **C3, inventory arbitrage.** Rejected: two independent callbacks can fill only one leg, only the bot owner benefits, and it's the first idea in the brief.
- **C4, an EIP-7702 wallet tripwire (Set It and Forget It).** Rejected: 7702 support on these testnets is unverified, and a delegated EOA raises security questions we can't answer within the window.

**Consequences:**
- It sits close to Reactive's own legacy `uniswap-v2-stop-take-profit-order` demo.
- What sets it apart: v4 LP positions, the Omni library, and the measured "what one second buys" figure.

**Kill criteria, by 2026-11-13:**
- (a) Loop median over 5 s.
- (b) A liquidity decrease can't run from a callback within the gas limit.
- (c) A visible entrant ships the same idea.

**Evidence:** `internal/research/DOSSIER.md` (Decision, §5–7), and the thesis break test in the same file's change log.

## D-002 · Sprint profile for the operating system · 2026-11-06 · accepted
**Context:** One person is building, part-time, alongside another hackathon (NEAR).

**Decision:** Use foundation's sprint profile. Work items are a checklist in docs/PLAN.md, and work lands as small commits on `main` that pass the gate. No GitHub labels, milestones, templates or branch-per-issue PRs. CI stays.

**Alternatives:** The full profile was rejected: its ceremony costs more than it returns for a solo builder.

**Consequences:** Switch to full if a second builder joins.

## D-003 · Contracts toolchain · 2026-11-06 · accepted
**Decision:**
- Foundry 1.8.3, solc 0.8.38, `evm_version = "cancun"`.
- Libs: reactive-lib-omni v0.1.0, forge-std v1.17.0, v4-core v4.0.0, v4-periphery pinned to a recorded commit (it has no tags).
- The legacy `reactive-lib` is prohibited.

**Alternatives:**
- **Foundry 1.9.0** (released 2026-11-02). Deferred: the gate's exit-code behaviour (`forge lint --deny warnings`) was verified on 1.8.3 today. Re-check at M1.
- **solc 0.8.26**, to match v4's concrete contracts. Rejected: reactive-lib-omni requires `^0.8.29`.
- **A newer EVM target.** Rejected until spike S1 shows what Lasna accepts.

**Consequences:** Our sources can't be compiled in one unit with v4's `PoolManager` or `PositionManager`, which pin `pragma solidity 0.8.26` exactly. See D-004.

**Evidence:** pragma lookups and version queries recorded in docs/CONTEXT.md (Traps).

## D-004 · Test strategy · 2026-11-06 · accepted
**Decision:** Three layers.
1. **Unit tests** for Ripcord logic, with a test double for the Omni system contract placed at `0x8888…8888` via `vm.etch`. Test doubles stay inside `contracts/test/`.
2. **Fork tests** (`vm.createSelectFork`) against the *live* v4 PoolManager and PositionManager on the pool chain, instead of deploying v4 locally.
3. **On-chain end-to-end loops** on Lasna plus the pool chain. These are the only evidence used for public claims.

**Alternatives:**
- **Reactive's `reactive-test-lib`.** Rejected for now: its README says it etches the **legacy** `SERVICE_ADDR 0x…fffFfF` and targets `reactive-lib` v0.2.0+, so it's unverified for Omni.
- **Deploying v4 locally via `Deployers`.** Rejected: our sources need `^0.8.29`, which conflicts with PoolManager's `=0.8.26` in one compilation unit.

**Consequences:** Fork tests need an RPC env var in CI.

## D-005 · TypeScript side deferred to M1 · 2026-11-06 · accepted
**Decision:** `harness/` (latency recorder) and `web/` (read-only frontend) are scaffolded in M1, not now. Provisional pins looked up today: Node 26 LTS, TypeScript 6.0.3, viem 2.57.16. **TypeScript 7 is excluded**, because typescript-eslint 8.72.1 accepts only `>=4.8.4 <6.1.0`. All of these get re-checked at the scaffold. The frontend framework, hosting and design direction are chosen then (`impeccable shape`).

**Alternatives:** Scaffolding now was rejected: nothing in M0 needs it, and the pins would go stale.

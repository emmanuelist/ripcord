# Plan
Build window: 2026-11-04 12:00 UTC → 2026-12-05 20:00 UTC
Started: 2026-11-06 11:00 UTC

- **Deadline source:** DoraHacks page JSON `timelineEnd` 1796500800, shown on the page as "2026/12/05 21:00 (UTC+1)" (captured 2026-11-06 in `internal/research/raw/`).
- **Buffer:** 10% of the window, at least 2 hours and at most 24. Here that's 24 h.
- **Freeze:** 80% of the window, or 48 hours before the deadline, whichever is later.
- Checkpoints count from `Started:`.

| # | Milestone | When | Exit criteria (a stranger could check these) | Due | Status |
|---|---|---|---|---|---|
| M0 | Rigged | 10% | D-001 recorded. Contracts gate green locally and in CI. Spike S1 (Omni hello loop on the pool chain) and spike S2 (callback-driven liquidity decrease) each passed with tx hashes and raw receipts in docs/evidence/. Pool chain chosen by measurement (DECISIONS) | 2026-11-09 09:30 UTC | **done 2026-11-06** (E-001…E-007) |
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
- [x] **ops: testnet funds** (done 2026-11-06: 5.25 lREACT via the Sepolia faucet, 0.015 ETH bridged to Unichain Sepolia; CONTEXT.md). (owner: user claims drips to the project wallet `0x08e768752cA0F8a132cB82cB4bB4354470DD9111` (D-007), by 2026-11-07; the agent converts with `script/fund-lreact.sh`). Get ETH on Unichain Sepolia and/or Base Sepolia, plus lREACT on Lasna via a faucet: Ethereum Sepolia `0x9b9B…f434` or Base Sepolia `0x2afa…5967`, 1 ETH → 100 lREACT. The on-chain cap per request is 1 ETH on Base Sepolia and 50 ETH on Ethereum Sepolia, and any excess is kept (CONTEXT.md). Done when `cast balance` shows non-zero on Lasna and the pool chain for the deployer address.
- [x] **Contracts scaffold** (done 2026-11-06, E-002; v4-core pin changed by D-006). Foundry in `contracts/` with libs pinned per AGENTS.md (reactive-lib-omni v0.1.0, forge-std v1.17.0, v4-periphery `c6e4754dab11` carrying v4-core 1.0.2), solc 0.8.38, evm cancun. Done when the four gate commands exit 0, with output in the commit message.
- [x] **CI** (done 2026-11-06, E-007: first run green on github.com/emmanuelist/ripcord, private per D-009). `.github/workflows/ci.yml` runs the contracts gate on Foundry v1.8.3. Done when the first push shows a green run (needs the GitHub repo; ask about visibility first).
- [x] **Spike S1: Omni hello loop** (done 2026-11-06 on Unichain Sepolia, E-005: 5/5 loops, median 2 Unichain blocks / ~2 s. Base Sepolia not run: no Base funds). Code + 9 unit tests done (E-003). Deploy with `POOL=unichain ACCOUNT=<keystore> ./script/spike/s1-deploy.sh`, then measure with `./script/spike/s1-run.sh` (from `contracts/`). A minimal reactive contract on Lasna subscribes to a `Ping` event on the pool chain and calls back a `Pong` receiver on the same chain. Run it 5× on Unichain Sepolia, and 5× on Base Sepolia if funds allow. Done when 5 hash triples (origin, Lasna, callback) are saved with raw receipts, plus the median latency per chain. This also proves Lasna accepts cancun bytecode from solc 0.8.38.
- [x] **Spike S2: callback-driven exit** (done on-chain 2026-11-06, E-006: tokenId 7943 liquidity 1e20 → 0 via the real proxy, 2 Unichain blocks, approve custody). Fork-verified against the deployed PositionManager (E-004): full exit 196.5k gas of a 1M limit, 9 tests including custody. Kill criterion (b) is cleared on fork. Still needed: one on-chain exit through the real callback proxy, which comes with S1 funding. On the chosen chain, a callback contract that owns a v4 position NFT runs `modifyLiquidities` with DECREASE_LIQUIDITY + TAKE_PAIR when called through the callback proxy. Done when there's a tx hash showing the liquidity drop to 0 and the gas used is recorded against the callback gas limit.
- [x] **Decide the pool chain:** Unichain Sepolia (D-008). from the S1 numbers and funding reality, and record it in DECISIONS.

### M1 · Walking skeleton (detailed 2026-11-06)
- [x] **Core contracts** (done 2026-11-06, E-008: 21 reactive unit tests + 21 vault fork tests on live v4, gate green; line cap 8 per D-012). `RipcordVault` (Unichain Sepolia: arm / disarm / exit, approve custody D-010, `ExitFailed` on a caught failure) and `RipcordReactive` (Lasna: learns lines from vault events, subscribes to each armed pool's `Swap` topic1 = poolId, fires one exit per crossed line, D-011). Done when unit tests (system stub) and fork tests (live v4) cover arm guards, crossing in both directions, one-shot lines, forged callbacks, approval revoked → `ExitFailed`, and the gate is green.
- [x] **Deploy the skeleton** (done 2026-11-06, `docs/evidence/m1/deploy.json`). Vault + reactive at precomputed addresses, plus a demo pool of disclosed test tokens and a position armed by the project wallet. Done when the addresses are in STATE and CONTEXT.
- [x] **One real loop** (done 2026-11-06, E-009: tokenId 7944, swap → exit in 2 Unichain blocks / 2 s, liquidity 1e21 → 0; `subscribe()` inside `react()` works on Omni). A real swap through the v4 `PoolSwapTest` router crosses the line → Lasna `react()` → callback → liquidity 0. Done when three hashes and raw receipts are in docs/evidence/. **Risk:** `subscribe()` called *inside* `react()` is unverified on Omni. Fallback: subscribe to all PoolManager `Swap`s and filter in `react()`.
- [x] **Harness** (done 2026-11-06, E-010: run 7945, swap → exit 3 Unichain blocks / 3 s on-chain, bounded per-hop wall clock; CI job added) (`harness/`, TypeScript + viem, pins re-checked per D-005). It records wall-clock per hop (swap mined → Lasna react seen → exit seen) and writes evidence JSON. Done when one run reproduces the loop's hashes with per-hop ms.
- [ ] **Read-only frontend** (`web/`). Direction comes from `impeccable shape`. It shows the armed position, live tick vs line, status (armed / exited / failed / approval missing), and exit events, all read from chain. Done when it's deployed to a public URL. **Hosting is the user's call** (D-pending).

### M2 · Core claim
- [ ] Placeholder. Includes the "what one second buys" source: a real mainnet crash price series (research needed).

### M3 · Proof surface
- [ ] Placeholder.

### M4 · Submitted
- [ ] Placeholder.
- [ ] **Flip github.com/emmanuelist/ripcord to public** before submitting (D-009, a rule of the event). Then confirm the link loads logged-out in a private window.

## Cut list
Things deliberately not being built. Each entry links the DECISIONS entry that cut it.
- Cross-chain price-sync fee hook (C1): D-001

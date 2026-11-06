# Evidence
Every public claim, and the proof behind it. Proofs are append-only. Claims are re-checked against live state before anything is published.

## Claims
| # | Claim (verbatim) | Appears in | Proof | Status | Checked |
|---|---|---|---|---|---|
| C-1 | Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running. | AGENTS.md h1 (internal). Planned for the README subtitle, repo description, DoraHacks form and the video close | none yet: needs the M2 latency runs | unverified | 2026-11-06 |
| C-2 | What one second buys: the Omni-vs-legacy latency gap converted into bps, using the speed of a real mainnet crash | planned: README, video | none yet: needs a historical price source (research) and C-1's N | unverified | 2026-11-06 |

**Break test for C-1** (from `/hackathon thesis`, 2026-11-06):
- **"A big swap blows through the line."** True, but it doesn't contradict "within N seconds". Goes in the limits section.
- **"An unfunded contract never exits."** True. Goes in the limits section, and the UI shows exit runway.
- **"Reactive's validators are your bot."** Answered by the wording "nothing *of yours*".

## Proofs
| # | Date | Claim | Proof | Commit |
|---|---|---|---|---|
| E-001 | 2026-11-06 | Every dependency Ripcord's core flow needs exists on-chain: chain IDs, the Lasna system contract, the callback proxies, the v4 PoolManager, PositionManager, StateView and test routers on Unichain Sepolia and Base Sepolia, and the PositionManager selectors we call. Block times: Lasna ~1.07 s, Unichain 1.0 s, Base 0.2 s | `docs/evidence/E-001-dependency-checks-2026-11-06.txt` (commands + raw output) | f8cb9be |
| E-002 | 2026-11-06 | The contracts toolchain works as pinned. reactive-lib-omni v0.1.0 and the v4-periphery/v4-core interfaces compile together under solc 0.8.38 / cancun. The gate is green: fmt, lint `--deny warnings`, build, and 7/7 tests pinning the system address, wildcard topic, `onlySystem`, callback selector, Swap topic0, PositionManager selectors and Action codes. Verified that `forge fmt --check` exits 1 on an unformatted file | `docs/evidence/E-002-contracts-gate-2026-11-06.txt` | b29ea72 |
| E-003 | 2026-11-06 | The spike S1 contracts behave as designed in local tests: subscription params, `onlySystem`, wrong-chain/emitter rejection, a ≥100k-gas callback request with the expected payload, proxy-only `pong`, flagging of an unexpected injected sender, and a full simulated loop applying the documented sender overwrite. 16/16 tests, gate green. **Local only**: this proves none of the Reactive behaviour, which S1 on testnet does | `docs/evidence/E-003-spike-s1-gate-2026-11-06.txt` | 409d8c8 |
| E-004 | 2026-11-06 | On a fork of live Unichain Sepolia (block 67121755), a call through the callback proxy address removes **all** liquidity from a position minted by the deployed PositionManager, using **196,497 gas** of a 1,000,000 limit. It rejects a direct caller, a foreign reactive contract, a second exit, an unowned/unapproved position and a subscribed position. Approved-operator custody works, and `transferFrom` clears subscriptions on the deployed bytecode. 25/25 tests, gate green. **Fork only**: Reactive's proxy delivery isn't exercised | `docs/evidence/E-004-spike-s2-fork-2026-11-06.txt` | 449ed79 |
| E-005 | 2026-11-06 | **Spike S1 on-chain: the Omni loop works.** 5/5 loops Unichain Sepolia → Lasna → Unichain Sepolia. The callback lands 2 Unichain blocks after the origin block (4/5) or 3 (1/5): median 2 s on Unichain's clock. Wall clock with polling: median 4,454 ms (upper bound). The injected sender is the requesting reactive contract (5/5). Lasna accepts solc 0.8.38 / cancun bytecode. The earlier 200k-gas deployment failed with OutOfGas inside the proxy (root cause and trace in CONTEXT.md and `docs/evidence/s1/unichain-v2-callback-oog-trace-2026-11-06.txt`) | `docs/evidence/E-005-spike-s1-unichain-2026-11-06.md` + `docs/evidence/s1/unichain-loop-{1..5}.json` (raw receipts) | (this commit) |

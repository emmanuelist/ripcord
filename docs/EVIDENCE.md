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
| E-002 | 2026-11-06 | The contracts toolchain works as pinned. reactive-lib-omni v0.1.0 and the v4-periphery/v4-core interfaces compile together under solc 0.8.38 / cancun. The gate is green: fmt, lint `--deny warnings`, build, and 7/7 tests pinning the system address, wildcard topic, `onlySystem`, callback selector, Swap topic0, PositionManager selectors and Action codes. Verified that `forge fmt --check` exits 1 on an unformatted file | `docs/evidence/E-002-contracts-gate-2026-11-06.txt` | (this commit) |

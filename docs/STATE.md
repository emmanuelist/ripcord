# State
_Last verified: 2026-11-06 13:55 UTC at the scaffold commit_

**Thesis:** Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running.

**Milestone:** M0 · Rigged (checkpoint 2026-11-09 09:30 UTC) · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** write the spike S1 contracts (Ping emitter, Omni reactive contract, Pong receiver) with unit tests. Writing them needs no funds; deploying them does (M0 checklist in docs/PLAN.md).

**Blocked on:** testnet funds for spikes S1 and S2 (owner: user, since 2026-11-06). Also a GitHub repo and its visibility (user decision) for CI.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Every core dependency exists on Lasna, Unichain Sepolia and Base Sepolia | cast checks run 2026-11-06 13:36 UTC | E-001 |
| Contracts gate green: fmt, lint `--deny warnings`, build, 7/7 tests pinning verified dependency facts | `forge fmt --check && forge lint --deny warnings && forge build --sizes && forge test` in `contracts/` | E-002 |
| Clock hook prints the time left from docs/PLAN.md | `echo '{}' \| node .claude/hooks/clock.mjs \| jq .` | foundation commit |

## Deployed
| What | Network | Address / URL | Last checked |
|---|---|---|---|
| nothing yet | | | |

## Broken or unverified
- No Ripcord code exists yet (only the toolchain test). Every Ripcord capability is unverified.
- CI workflow written but never run: there's no GitHub remote yet.
- Lasna acceptance of solc 0.8.38 / cancun bytecode: unverified (spike S1).
- Liquidity decrease from a callback within the gas limit: unverified (spike S2, kill criterion b).

## Claims not yet verified
- C-1 the thesis: needs N measured over ≥10 runs (M2).
- C-2 what one second buys: needs a historical crash price source and N.

## Open questions
- Unichain Sepolia or Base Sepolia as the pool chain? Decided by S1 numbers and funding (user + agent).
- REACT/USD conversion date and payout timing: user asks the organizers in the DoraHacks Q&A.
- Is there any live judging call for finalists, or is it video only? Same.

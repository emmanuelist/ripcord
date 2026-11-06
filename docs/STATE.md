# State
_Last verified: 2026-11-06 14:10 UTC at the spike S2 commit_

**Thesis:** Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running.

**Milestone:** M0 · Rigged (checkpoint 2026-11-09 09:30 UTC) · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** once funded, run spike S1 on Unichain Sepolia: `POOL=unichain ACCOUNT=<keystore> ./script/spike/s1-deploy.sh`, then `RUNS=5 ./script/spike/s1-run.sh` (from `contracts/`). The same funding also unlocks one on-chain S2 exit through the real proxy.

**Blocked on:** testnet funds for spikes S1 and S2 (owner: user, since 2026-11-06). Also a GitHub repo and its visibility (user decision) for CI.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| Every core dependency exists on Lasna, Unichain Sepolia and Base Sepolia | cast checks run 2026-11-06 13:36 UTC | E-001 |
| Spike S1 contracts (PingSource, PingReactive, PongSink) pass 9 local unit tests, including a simulated full loop. Local only | `forge test` | E-003 |
| Spike S2: a proxy-gated exit removes all liquidity from a real v4 position on a fork of live Unichain Sepolia, using 196.5k gas of a 1M limit. Fork only | `forge test --match-path test/spike/S2.fork.t.sol` | E-004 |
| Contracts gate green: fmt, lint `--deny warnings`, build, 25/25 tests (fork tests hit the public Unichain RPC) | `forge fmt --check && forge lint --deny warnings && forge build --sizes && forge test` in `contracts/` | E-002 |
| Clock hook prints the time left from docs/PLAN.md | `echo '{}' \| node .claude/hooks/clock.mjs \| jq .` | foundation commit |

## Deployed
| What | Network | Address / URL | Last checked |
|---|---|---|---|
| nothing yet | | | |

## Broken or unverified
- No Ripcord product code yet. Spike S1 exists but is undeployed, and every Reactive behaviour is unverified on-chain.
- `s1-deploy.sh` and `s1-run.sh` have never run against funded accounts. Their `cast` calls were dry-checked read-only against live RPCs, but `cast logs` with an event signature plus a decimal indexed arg hasn't matched a real log yet.
- CI workflow written but never run: there's no GitHub remote yet.
- Lasna acceptance of solc 0.8.38 / cancun bytecode: unverified (spike S1).
- Liquidity decrease through Reactive's real callback proxy: fork-verified only (E-004). Not yet on-chain.

## Claims not yet verified
- C-1 the thesis: needs N measured over ≥10 runs (M2).
- C-2 what one second buys: needs a historical crash price source and N.

## Open questions
- **Custody model for Ripcord's vault (decide at M1):** *approve* (the user keeps the NFT, but can re-subscribe it or move it, which kills the approval and leaves the exit to fail visibly) vs *deposit* (the vault holds the NFT, subscriptions are cleared, and the user must withdraw to manage the position). Both work on the deployed bytecode (E-004). User + agent decide.
- Unichain Sepolia or Base Sepolia as the pool chain? Decided by S1 numbers and funding (user + agent).
- REACT/USD conversion date and payout timing: user asks the organizers in the DoraHacks Q&A.
- Is there any live judging call for finalists, or is it video only? Same.

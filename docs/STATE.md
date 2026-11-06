# State
_Last verified: 2026-11-06 15:35 UTC at a3b42ba_

**Thesis:** Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running.

**Milestone:** M0 · Rigged (checkpoint 2026-11-09 09:30 UTC) · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** run spike S2 on-chain. Deploy a reactive contract that answers a Ping with `ExitProbe.exit(address(0), tokenId)` through the real Unichain Sepolia callback proxy, against a real v4 position the project wallet mints. That closes S2 and M0 apart from CI.

**Blocked on:** a GitHub repo and its visibility (user decision), for CI.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **Omni loop on-chain:** a Unichain Sepolia event → Lasna `react()` → Unichain Sepolia callback, 5/5 runs, median 2 Unichain blocks (~2 s) | `script/spike/s1-run.sh` against live chains | E-005 |
| Omni injects the requesting reactive contract's address as the callback's first argument | `injectedSenderMatches` true in 5/5 loops | E-005 |
| Callback-driven v4 exit pulls all liquidity: 196.5k gas of the 823.5k the proxy forwards from a 1M request. Fork only | `forge test --match-path test/spike/S2.fork.t.sol` | E-004 |
| Contracts gate green: fmt, lint `--deny warnings`, build, 26/26 tests | gate commands in `contracts/` | E-004, c5ea35b |
| Project wallet `0x08e768752cA0F8a132cB82cB4bB4354470DD9111` funded with lREACT on Lasna and ETH on Unichain Sepolia | `cast balance` | CONTEXT.md (funding paths) |
| Clock hook prints the time left from docs/PLAN.md | `echo '{}' \| node .claude/hooks/clock.mjs \| jq .` | foundation commit |

## Deployed (Unichain Sepolia = pool chain, D-008)
| What | Network | Address | Last checked |
|---|---|---|---|
| PingSource (S1 v3) | Unichain Sepolia | 0xd5342bccbf38c25b2c76a154b28000deabafc31e | 2026-11-06 |
| PongSink (S1 v3) | Unichain Sepolia | 0xa458e60f62d2964ade804570cedd2f91d3f149c9 | 2026-11-06 |
| PingReactive (S1 v3) | Lasna | 0x35578bDBc23a6DF3543FbeC51D9A28E51AA22097 | 2026-11-06 |

v1 and v2 spike deployments are superseded: records in `docs/evidence/s1/unichain-v{1,2}-*`. v2's callback gas limit was too low.

## Broken or unverified
- S2 through Reactive's real proxy: unverified on-chain (fork only).
- Per-hop wall-clock latency (origin → Lasna → callback): unmeasured. Lasna's clock skews ~1 s, so block timestamps can't time that hop (needs the M1 harness).
- Base Sepolia as the pool chain: not measured, and there are no Base funds.
- CI: written, never run, no GitHub remote.

## Claims not yet verified
- C-1 the thesis: needs N measured on the *real* Ripcord loop (a Swap crossing the line → exit) over ≥10 runs. S1's ~2 s is a lower-bound indicator, not N.
- C-2 what one second buys: needs a historical crash price source and N.

## Open questions
- Custody model for the vault (decide at M1): **approve** (user keeps the NFT) vs **deposit**. Both work on the deployed bytecode (E-004). Agent leans towards approve.
- REACT/USD payout rate and date; live judging or video only: the user asks the organizers in the DoraHacks Q&A.

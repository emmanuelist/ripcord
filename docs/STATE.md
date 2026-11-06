# State
_Last verified: 2026-11-06 15:50 UTC after S2 on-chain_

**Thesis:** Your Uniswap v4 position leaves the pool within N seconds of crossing your line, with nothing of yours running.

**Milestone:** M1 · Walking skeleton (checkpoint 2026-11-18 05:00 UTC). M0 done 2026-11-06, ahead of its 11-09 checkpoint · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** M1 items 2+3. Deploy RipcordVault (Unichain Sepolia) + RipcordReactive (Lasna) at precomputed addresses, plus a demo pool and an armed position. Then push one real swap across the line and capture the three-hop loop. First on-chain test of `subscribe()` *inside* `react()` (fallback in PLAN).

**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **Omni loop on-chain:** a Unichain Sepolia event → Lasna `react()` → Unichain Sepolia callback, 5/5 runs, median 2 Unichain blocks (~2 s) | `script/spike/s1-run.sh` against live chains | E-005 |
| Omni injects the requesting reactive contract's address as the callback's first argument | `injectedSenderMatches` true in 5/5 loops | E-005 |
| **Reactive callback exits a real v4 position on-chain:** tokenId 7943 liquidity 1e20 → 0 through the real proxy, 2 Unichain blocks after the trigger, owner kept the NFT (approve custody), `exit()` 140k gas | `script/spike/s2-run.sh` against live chains | E-006 |
| **Ripcord core contracts** (vault + reactive): 21 unit + 21 live-v4 fork tests. A real swap crossing a line → delivered callback → all liquidity removed. Failures (revoked approval, moved NFT, late subscriber) become `ExitFailed`. Local and fork only | `forge test` | E-008 |
| Contracts gate green: fmt, lint `--deny warnings`, build, 75/75 tests, 0 compiler warnings | gate commands in `contracts/` | E-008 |
| Project wallet `0x08e768752cA0F8a132cB82cB4bB4354470DD9111` funded with lREACT on Lasna and ETH on Unichain Sepolia | `cast balance` | CONTEXT.md (funding paths) |
| CI green on GitHub Actions, private repo github.com/emmanuelist/ripcord | first run | E-007 |
| Clock hook prints the time left from docs/PLAN.md | `echo '{}' \| node .claude/hooks/clock.mjs \| jq .` | foundation commit |

## Deployed (Unichain Sepolia = pool chain, D-008)
| What | Network | Address | Last checked |
|---|---|---|---|
| PingSource (S1 v3) | Unichain Sepolia | 0xd5342bccbf38c25b2c76a154b28000deabafc31e | 2026-11-06 |
| PongSink (S1 v3) | Unichain Sepolia | 0xa458e60f62d2964ade804570cedd2f91d3f149c9 | 2026-11-06 |
| PingReactive (S1 v3) | Lasna | 0x35578bDBc23a6DF3543FbeC51D9A28E51AA22097 | 2026-11-06 |
| ExitTriggerSource (S2) | Unichain Sepolia | 0x6e9468b5fab6f86ea3964898fcee987c70ac8ab0 | 2026-11-06 |
| ExitProbe (S2) | Unichain Sepolia | 0x353bcf336d580183bdb4cb377b0c23190707a185 | 2026-11-06 |
| ExitReactive (S2) | Lasna | 0x27F0B7391B5B66d7Ba14F45bfC9E4CEe50a31710 | 2026-11-06 |

v1 and v2 spike deployments are superseded: records in `docs/evidence/s1/unichain-v{1,2}-*`. v2's callback gas limit was too low.

## Broken or unverified
- Per-hop wall-clock latency (origin → Lasna → callback): unmeasured. Lasna's clock skews ~1 s, so block timestamps can't time that hop (needs the M1 harness).
- Base Sepolia as the pool chain: not measured, and there are no Base funds.

## Claims not yet verified
- C-1 the thesis: needs N measured on the *real* Ripcord loop (a Swap crossing the line → exit) over ≥10 runs. S1's ~2 s is a lower-bound indicator, not N.
- C-2 what one second buys: needs a historical crash price source and N.

## Open questions
- Frontend hosting (needed for M1's last item): the user picks Vercel, Netlify, Cloudflare Pages, or a claude.ai Artifact page.
- REACT/USD payout rate and date; live judging or video only: the user asks the organizers in the DoraHacks Q&A.

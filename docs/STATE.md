# State
_Last verified: 2026-11-14, after benchmark fixes B2–B4 (E-018 … E-021)_

**Thesis:** Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running. (Verified for testnet, 50 of 50 loops on Unichain's clock, E-019, D-016.)

**Milestone:** M3 · Proof surface (freeze 2026-12-03). README done; benchmark run (19/24) and its fixes B2, B3, B4 done; **B1 (run of show + video) open**; B5 at submission · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** B1: the user watches `video/out/ripcord-final.mp4` (2:15, E-022) and picks where it's hosted; then upload, play it logged-out in a private window, and link it in the README and submission.

**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **50 real loops:** 50 of 50 exited within 3 s of the crossing swap on Unichain's clock (1 s ×1, 2 s ×42, 3 s ×7; median 2, p90 3); fastest #7977 in the next block | harness `npm run measure`; spot re-checks with `cast` | E-019 |
| **Why it needs Omni:** Lasna hop first seen a median 1.8 s after the swap (49 runs) vs legacy's ~7 s blocks; crash data: median 15.7 vs 25.0 bps within 3 s vs 7 s (10 Oct 2025), reproducible | `harness/scripts/what-one-second-buys.sh` | E-018, E-019 |
| **A loop anyone can run:** RipcordTryout `arm()` + `cross(tokenId)`; #8015 exited 2 blocks after its swap; #8016 watched on the page ARMED → BOARDING → DEPARTED | live txs, Playwright | E-020 |
| **Three refusals on-chain** (stops short; direct `exit()` reverts `NotAuthorized`; revoked approval → `ExitFailed: NotApproved`) | harness `npm run reversals` | E-016 |
| **Web, public:** https://ripcord-ashy.vercel.app loads all 54 positions logged-out in ~7 s, no errors; hero, departure + replay, board, service strip, refusal room, the "why the seconds matter" note | Playwright logged-out | E-021 |
| README as a proof surface: thesis, why Omni, 50 loops, refusals, read-only checks, run a loop yourself, limits; every sentence has a claims row (C-1 … C-37) | claims check | docs/EVIDENCE.md |
| Gates: contracts 83/83 (fmt, lint --deny warnings, sizes); harness 18; web eslint 0, tsc, 21, build; detector clean | gate commands | this commit |
| MIT license | `LICENSE` | `3d6a860` |
| Funds: RipcordReactive 5.81 lREACT (≈160 exits); vault 0.00098 ETH; wallet 10.86 lREACT (Lasna), 0.00698 ETH (Unichain), 0.054 ETH (Sepolia) | `cast balance` | — |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| **RipcordVault** | Unichain Sepolia | 0x641413bb227c5452ef2b968c9774bc31f5f54c98 | 2026-11-14 |
| **RipcordReactive** | Lasna | 0xA2deA4D676236Aa905c0Cb1B90712Fc3591af2B5 | 2026-11-14 |
| **RipcordTryout** | Unichain Sepolia | 0xfDF1b11aae05a8a0620Fe56AD3C9A2Bd7431A698 (stock 200,000 RDA/RDB) | 2026-11-14 |
| Demo pool (RDA/RDB test tokens) | Unichain Sepolia | poolId 0xcd8519fedccc6235e1775b43017dc99d10e3be81b9989bda25d9d4a20aa3d064 | 2026-11-14 |
| **Web (production, public)** | Vercel `emmanuel-pauls-projects/ripcord` | **https://ripcord-ashy.vercel.app** | 2026-11-14 |

Deploy the web with `web/scripts/deploy-vercel.sh` (prebuilt static, no source maps, D-015). The Vercel Git connection is removed on purpose: don't re-link it.

## Broken or unverified
- The page's and README's GitHub links and the CI badge 404 for visitors until the repo goes public at submission (D-009, B5).
- Not checked yet: the public page on a phone over cellular (preflight, M4).
- The flap's two-half fall is judged from code; at 130 ms per step it can't be captured frame by frame.
- The demo video is rendered (2:15, E-022) but not uploaded or linked yet (B1).

## Claims not yet verified
- None. (C-2 verified 2026-11-14 from E-018.)

## Open questions
- REACT/USD payout rate and date; live judging or video only: the user asks the organizers in the DoraHacks Q&A.
- Video hosting: YouTube (unlisted, the user's account) or another host? ElevenLabs free tier asks for attribution: credit it in the video description.

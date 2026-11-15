# State
_Last verified: 2026-11-14, after benchmark fixes B2–B4 (E-018 … E-021)_

**Thesis:** Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running. (Verified for testnet, 50 of 50 loops on Unichain's clock, E-019, D-016.)

**Milestone:** M3 · Proof surface (freeze 2026-12-03). README done; benchmark run (19/24) and its fixes B2, B3, B4 done; **B1 (run of show + video) open**; B5 at submission · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** the UI pass by 2026-11-28 (impeccable critique + polish, the motion pass, `/benchmark judge`); before the deadline, tag the commit the judges should see (`git tag submission`) and run `/hackathon preflight`.

**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **50 real loops:** 50 of 50 exited within 3 s of the crossing swap on Unichain's clock (1 s ×1, 2 s ×42, 3 s ×7; median 2, p90 3); fastest #7977 in the next block | harness `npm run measure`; spot re-checks with `cast` | E-019 |
| **Why it needs Omni:** Lasna hop first seen a median 1.8 s after the swap (49 runs) vs legacy's ~7 s blocks; crash data: median 15.7 vs 25.0 bps within 3 s vs 7 s (10 Oct 2025), reproducible | `harness/scripts/what-one-second-buys.sh` | E-018, E-019 |
| **A loop anyone can run:** RipcordTryout `arm()` + `cross(tokenId)`; #8015 exited 2 blocks after its swap; #8016 watched on the page ARMED → BOARDING → DEPARTED | live txs, Playwright | E-020 |
| **Three refusals on-chain** (stops short; direct `exit()` reverts `NotAuthorized`; revoked approval → `ExitFailed: NotApproved`) | harness `npm run reversals` | E-016 |
| **First screen at once (2026-11-15):** server-rendered from a build-time chain snapshot labelled "as of block #N", readable without JS, `og.png` link preview; `ui-audit.mjs` no FAIL lines, departure visible in 2.2 s (was 5–6 s) | `ui-audit.mjs` on production | E-024 |
| **Web, public:** https://ripcord-ashy.vercel.app loads all positions logged-out, no errors; hero, departure + replay, board, service strip, refusal room, the "why the seconds matter" note | Playwright logged-out | E-021 |
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
- **Repo public** (checked 2026-11-15 logged out: repo page, raw README and CI badge all 200). B5 done except the submission tag.
- Not checked yet: the public page on a phone over cellular (preflight, M4).
- The flap's two-half fall is judged from code; at 130 ms per step it can't be captured frame by frame.
- **Submitted to DoraHacks on 2026-11-14** (track Every Second Counts; the user pressed submit). Film on YouTube https://youtu.be/cIcXnYkJFyo, which plays logged out (oEmbed 200, 2026-11-14). Still to check: whether that upload is the final 2:35 cut or the 2:36 one before it. The README doesn't link the video yet.
- The featured departure falls back to #8014 a few hours after a tryout loop: the live poll scans only recent blocks and the tryout loops (#8015–#8023) aren't in `runs.json`, so they drop off the board. Adding them to the recorded history would keep the filmed #8023 featured.

## Claims not yet verified
- None. (C-2 verified 2026-11-14 from E-018.)

## Open questions
- REACT/USD payout rate and date; live judging or video only: the user asks the organizers in the DoraHacks Q&A.
- Video hosting: YouTube (unlisted, the user's account) or another host? ElevenLabs free tier asks for attribution: credit it in the video description.

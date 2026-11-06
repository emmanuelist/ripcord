# State
_Last verified: 2026-11-06 20:30 UTC, after the public-URL check_

**Thesis:** Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running. (Verified for testnet, 11/11 loops on Unichain's clock, D-016.)

**Milestone:** M1 · Walking skeleton (checkpoint 2026-11-18 05:00 UTC). **All five items done** (frontend public, E-015); stop for the user's go-ahead before M2 (phase gate) · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** with the user's go-ahead, M2's reversal beat (PLAN.md): a direct `RipcordVault.exit` call that reverts on-chain, and a swap that doesn't cross an armed line, each with hashes and receipts. Then the refusal room on the page.

**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **The Ripcord loop on-chain, 11 runs:** swap crosses the armed line → Lasna `react()` → callback → vault removes all liquidity. Swap → exit **median 2, p90 3, max 3 Unichain blocks; 2–3 s on Unichain's clock, 11 of 11** | harness `npm run measure`; 7953 and 7948 re-checked with `cast receipt` / `cast block` | E-012, E-013 |
| **Web v3** (`web/`): hero claim with a live evidence sentence; the featured departure (flaps, calling-at route with lamps and hashes, swap-to-exit count, ruler of real Unichain blocks, Replay at chain speed with the staged Lasna hop disclosed); the board (all-flap columns, status selectors, dates); a service strip with the live pool tick and funding (exits each balance covers, priced from the last loop's on-chain charges); cited contract lines evaluated with a real loop; live limits and custody reads | Playwright at 1440 and 390, a live run watched (#7954), finish review round 3: **ship** | E-013 |
| Live-run states render: ARMED (pool tick + headroom) → row lands → BOARDING → DEPARTED; funding re-priced live (17 → 16 exits) | real loop #7954 watched at 1440 + 390 | E-013 |
| Web data path: unseen positions start from the vault's `lines()` storage; history and live merge field by field (fixed the "line 0, BOARDING" bug) | regression tests, all 11 rows match their run records | `e0d891b` |
| Web gate: eslint 0 warnings, tsc, 21 tests, build; design detector clean | `npm run lint && npm run typecheck && npm test && npm run build` in `web/` | `3e605f7` |
| Contracts gate green (75/75), harness gate green; CI green on contracts, harness and web | GitHub Actions on `354e14a` | E-008, E-010 |
| **Every sentence on the page has a verified claims row** (C-3 … C-19); all 7 listed contracts have code on their chains | claims check + `cast code` | `f58cbb1` |
| DESIGN.md + `.impeccable/design.json` written from the shipped build | impeccable-documenter | d81ba4f |
| Funds: wallet 0.00699 ETH (Unichain), 1.917 lREACT (Lasna); RipcordReactive 0.603 lREACT (≈16 exits); vault 0.000995 ETH (≈2,210 exits) | `cast balance` | — |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| **RipcordVault** | Unichain Sepolia | 0x641413bb227c5452ef2b968c9774bc31f5f54c98 | 2026-11-06 |
| **RipcordReactive** | Lasna | 0xA2deA4D676236Aa905c0Cb1B90712Fc3591af2B5 | 2026-11-06 |
| Demo pool (RDA/RDB test tokens) | Unichain Sepolia | poolId 0xcd8519fedccc6235e1775b43017dc99d10e3be81b9989bda25d9d4a20aa3d064 | 2026-11-06 |
| **Web (production, public)** | Vercel, project `emmanuel-pauls-projects/ripcord` | **https://ripcord-ashy.vercel.app** (E-015; per-deployment URLs stay behind Vercel login) | 2026-11-06 |
| S1/S2 spike contracts | Unichain Sepolia / Lasna | see `docs/evidence/s1/`, `docs/evidence/s2/` | 2026-11-06 |

Deploy the web with `web/scripts/deploy-vercel.sh` (prebuilt static, no source maps, D-015).

## Broken or unverified
- Not checked yet: the public page on a phone over cellular (preflight, M4). Each push to `main` adds a failing Vercel Git build until the repo is disconnected from the Vercel project.
- The page's GitHub links (code citations pinned to `a7b4bbd`, the repo link) 404 for visitors until the repo goes public at submission (D-009).
- The flap's two-half fall is judged from code; at 130 ms per step it can't be captured frame by frame.
- Per-hop wall clock is loose (bounded by polling RTTs, E-010). Base Sepolia: not measured.

## Claims not yet verified
- C-2 what one second buys: needs a historical crash price source and N.

## Open questions
- REACT/USD payout rate and date; live judging or video only: the user asks the organizers in the DoraHacks Q&A.

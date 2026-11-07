# State
_Last verified: 2026-11-07, after the refusal room went public (E-017)_

**Thesis:** Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running. (Verified for testnet, 11/11 loops on Unichain's clock, D-016.)

**Milestone:** M2 · Core claim, **exit criteria met** 2026-11-07, ahead of its 2026-11-25 checkpoint. M0 and M1 met. Next is M3 · Proof surface (freeze 2026-12-03) · **Deadline:** 2026-12-05 20:00 UTC (time left: the clock line)

**Next action:** phase gate: confirm with the user, then start M3: the README as a proof surface (thesis, live link, one-click checks, limits), `benchmark`, then the video script. C-2 ("what one second buys") is carried from M2 and needs a mainnet crash price source (research).

**Blocked on:** nothing.

## Works (verified this session)
| Capability | Verified by | Evidence |
|---|---|---|
| **The Ripcord loop on-chain, 11 runs:** swap → exit 2 Unichain blocks (8 runs) or 3 (3 runs), 2–3 s on Unichain's clock | harness `npm run measure`; spot re-checks with `cast` | E-012, E-013 |
| **Three refusals on-chain:** a swap that stops short (line held, reaction billed, no callback); a direct `exit()` from a wallet reverts `NotAuthorized`; a revoked approval turns a real crossing into `ExitFailed: NotApproved`, liquidity untouched. 16 raw receipts | harness `npm run reversals` | E-016 |
| **Web, public:** https://ripcord-ashy.vercel.app: hero claim + live evidence; featured departure with Replay at chain speed; board of 13 positions (11 departed, 1 cancelled with its reason, 1 disarmed); live pool tick and funding; cited contract lines evaluated with a real loop; the refusal room read back by hash with a lamp strip per attempt | Playwright logged-out at 1440 and 390, no console errors; finish review: ship | E-015, E-017 |
| Web resilience: unseen positions start from vault storage; history and live merge; failed polls back off to 30 s and recover in 0.5 s on reconnect | regression tests; offline test in the browser | `e0d891b`, `61f4b18` |
| Gates: contracts 75/75; harness 14 tests; web eslint 0, tsc, 21 tests, build; design detector clean; CI green on all three jobs | gate commands; GitHub Actions | E-008, E-010 |
| Every sentence on the page has a verified claims row (C-1, C-3 … C-24) | claims check | docs/EVIDENCE.md |
| DESIGN.md + `.impeccable/design.json` match the shipped build, refusal room included | `.impeccable/gen-design-json.mjs` | `509d782` |
| Funds: wallet 0.00699 ETH (Unichain), 1.917 lREACT (Lasna); RipcordReactive 0.520 lREACT (≈14 exits); vault 0.000995 ETH (≈2,210 exits) | `cast balance` | — |

## Deployed
| What | Network | Address | Last checked |
|---|---|---|---|
| **RipcordVault** | Unichain Sepolia | 0x641413bb227c5452ef2b968c9774bc31f5f54c98 | 2026-11-06 |
| **RipcordReactive** | Lasna | 0xA2deA4D676236Aa905c0Cb1B90712Fc3591af2B5 | 2026-11-06 |
| Demo pool (RDA/RDB test tokens) | Unichain Sepolia | poolId 0xcd8519fedccc6235e1775b43017dc99d10e3be81b9989bda25d9d4a20aa3d064 | 2026-11-06 |
| **Web (production, public)** | Vercel `emmanuel-pauls-projects/ripcord` | **https://ripcord-ashy.vercel.app** | 2026-11-07 |

Deploy the web with `web/scripts/deploy-vercel.sh` (prebuilt static, no source maps, D-015). The Vercel Git connection is removed on purpose: don't re-link it.

## Broken or unverified
- The page's GitHub links (code citations pinned to `a7b4bbd`, the repo link) 404 for visitors until the repo goes public at submission (D-009).
- Not checked yet: the public page on a phone over cellular (preflight, M4).
- The flap's two-half fall is judged from code; at 130 ms per step it can't be captured frame by frame.
- Base Sepolia: not measured.

## Claims not yet verified
- C-2 what one second buys: needs a historical crash price source (research) and N (done).

## Open questions
- REACT/USD payout rate and date; live judging or video only: the user asks the organizers in the DoraHacks Q&A.

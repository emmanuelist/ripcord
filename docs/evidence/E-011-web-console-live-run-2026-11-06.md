# E-011 The web console shows a real Ripcord loop as it happens (2026-11-06)

**Setup:** `web/` dev build (Vite + React + viem) open in Chromium at 1440×900, reading the public Unichain Sepolia and Lasna RPCs directly. A Playwright script read the DOM every 250 ms. The harness then ran one real loop (`harness/`, RUNS=1).

**What the page showed, by itself** (ms after the watcher started):

| UI state of #7946 | at | what caused it on-chain |
|---|---|---|
| row appears, **ARMED** | +33,923 | vault `LineArmed` log |
| **BOARDING**, lead tick −395 → −590 | +45,496 | Lasna `RipcordPulled`; the crossing swap moved the tick |
| **DEPARTED**, 3 blocks | +49,268 | vault `Exited` log |

- After the run, 19 flap glyphs carried the turn animation. On first page load none do (turns only happen on change).
- The rail followed the newest event without a click.
- Capture: `docs/evidence/E-011-console-live-7946.png`.

**On-chain truth for the same run (harness, `docs/evidence/harness/run-7946.json`):**
- swap `0x7195deb7990ca9425ff6c03ce345223bc9b67b3525c763a5dddb05bb5befc7af`
- exit `0x330ee41f74ec34dff8f759437eea34a9f4327f976bdab42901c85c95e274c18b`
- **3 Unichain blocks / 3 s swap → exit**
- Wall-clock swap seen → exit seen [3.53, 5.43] s
- RTT Unichain 290 ms, Lasna 464 ms (the fixed RTT probe now reads real values)

**Data path (no mocks):**
- History comes from transaction receipts by hash (`web/src/data/runs.json`, generated from this evidence folder).
- Live updates come from batched `eth_blockNumber` + `eth_getLogs` + multicall every 1.5 s, measured at ~1.3 req/s per chain.
- `web/test/model.test.ts` decodes position 7944's real receipts and matches every field verified in E-009.

**Gate:**
- eslint 0 warnings, tsc, 17 tests, `vite build`
- impeccable design detector clean
- no horizontal overflow and no wrapped hashes at 390 or 1440
- CI green on all three jobs (contracts, harness, web)

# Ripcord: the video cut

**Thesis (C-1), the first and last thing on screen:** *Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.* (testnet, 50 of 50 loops)

Judges see only this video (DOSSIER: no live demo is mentioned), so the video is the demo. Limit: under 3:00. Target: **2:40**, leaving 20 s of margin.

## How it's made (the submission film, v2)
Re-cut on Warrant's film system (the `hackathon` skill's `reference/film.md`). It lives in `internal/film/`, which is gitignored and kept out of the submitted code. The content changed; the machinery is the same: the camera, the score, the word-aligned captions, the terminal and the cards.

- **Footage:** `internal/film/scripts/shoot.mjs` records the public page, https://ripcord-ashy.vercel.app, through Chrome's own screencast at 2x (3040×1712). While it records, the project wallet sends a real RipcordTryout `arm()` and `cross(tokenId)`, signed through `cast` with the encrypted keystore (D-007). Before any shot holds, it waits for the split-flap to settle: the markup unchanged for 450 ms, with no animation running. `explorers.mjs` films the same loop's transactions on Blockscout (Unichain Sepolia) and Reactscan (Lasna). Uniscan was skipped because it shows a Cloudflare bot check to headless browsers.
- **The camera:** each move is the measured rectangle of a page element at that moment of the take. Footage outside the target is dimmed (a spotlight), so the subject fills the frame.
- **The cut:** chapters are cut on the score's beat grid (31 frames at 30 fps). The only footage removed is the wait for `arm()` to be mined, which comes before the swap. From the crossing swap to DEPARTED the take is uncut and not sped up, and the shot says so.
- **Voice:** ElevenLabs "Daniel", `eleven_multilingual_v2`. The word timing for the captions comes from the same call (`with-timestamps`). Played at 1.05× tempo with pitch kept; that is the voice only, the footage is never sped up. The free tier needs attribution: credit "Voice: ElevenLabs" in the video description.
- **Score:** synthesised with ffmpeg (`score.ts`), so there is no licence to clear. It ducks under the voice. A riser runs into DEPARTED, with a release on the flip, and a bolt lands on each refusal stamp.

## Chapters
| # | Chapter | What's on screen | Honest label | Claims |
|---|---|---|---|---|
| 01 | Hook card | "A Uniswap v4 position has no stop." with **25.0 bps** (ETH's median fall within 7 s, worst half hour of 10 Oct 2025) | Binance 1-second candles | C-25, C-37 |
| 02 | How a ripcord pulls | Diagram from the real calls: `RipcordVault.arm` → PoolManager `Swap` → `RipcordReactive.react` → `requestCallbackV_1_0` → `RipcordVault.exit` (`DECREASE_LIQUIDITY + TAKE_PAIR`) | — | C-14, C-6, C-7, C-8 |
| 03 | A live departure | The departure panel fills the frame: ARMED, then the cross swap, then DEPARTED. The cursor ends on "Replay this departure" | Live · not sped up · uncut from swap to exit | C-35, C-8 |
| 04 | Swap to exit | Click replay. The camera zooms to the meter as it counts to the filmed loop's real count ("2 BLOCKS") | Replay of the same loop at chain speed | C-36, C-13 |
| 05 | What it refuses | Each strip shows its action, then a stamp lands: HELD, REVERTED, CANCELLED | Recorded 6 Nov 2026 · read back from chain now | C-20 – C-23 |
| 06 | Fifty of fifty | **50 of 50** exits within 3 s, the 1 s / 2 s / 3 s distribution (1 / 42 / 7), and 3 s against one ~7 s legacy block | Testnet · Unichain block timestamps | C-27, C-1, C-36, C-37 |
| 07 | Check it yourself | A terminal with read-only `cast` checks run during the shoot, with their real output: the block timestamps, the exit's sender (Reactive's relayer), the Lasna tx to `0x8888…`, line status 2. Then Blockscout and Reactscan | Read-only checks · public RPCs; Public explorers | C-8, C-13 |
| 08 | End card | "Out within 3 seconds.", then the thesis, "Testnet only · not audited", the live URL, the code and both contracts | — | C-1, C-11 |

Rebuild from `internal/film/` (Node 26, `FILM_CHROME` = Playwright's `chrome-headless-shell`; Remotion's own download lacks its ICU data on this machine):
```bash
npm ci
node scripts/shoot.mjs          # a real tryout loop + the refusal room (sends 2 txs from the project wallet; 60 s cooldown)
node scripts/explorers.mjs      # read-only
npx tsx scripts/voice.ts && npx tsx scripts/align.ts    # only lines not yet synthesised (--count to see the cost first)
npx tsx scripts/render.ts && npx tsx scripts/score.ts && bash scripts/film-master.sh   # → film/ripcord-master.mp4
```

The first cut (v1, `video/`, 2:15, loop #8022) is kept as a fallback. It read as a page scrolling under subtitles.

## Never on screen
`.env`, the keystore, the password file, any private key or seed phrase, a live terminal session, or a browser profile with history, bookmarks or notifications. The film's terminal is drawn by the composition from read-only `cast` output captured during the shoot. It has no signing commands and no environment.

## Deliberately not in this video
- An architecture diagram or slide. The page's own "How a ripcord pulls" section covers it, and the README links the source lines.
- The team, a roadmap, mainnet plans, or any yield, return or price figure beyond C-2's crash data.
- The test suites. Those are in the README, where a judge can run them.
- The contracts table and custody section. They're on the page, one scroll away.
- Phone layout.

## Before upload
- [ ] Claims check: every narration line above maps to a `verified` row, re-checked against live state the day it's recorded
- [ ] Narrated numbers match the frames they play over (#ID, N s, the fifty loops, the crash figures)
- [ ] Length under 3:00 (target 2:40)
- [ ] One throwaway take recorded and watched first
- [ ] Uploaded as unlisted / anyone-with-the-link; played in a private window, logged-out, start to finish
- [ ] Linked in the README and the submission; new claims rows added for anything the video says that isn't already a row

## Rebuild the v1 cut (video/)
From `video/` (Node 26):
```bash
npm ci
npm run capture      # a real tryout loop, recorded from the public page (sends 2 txs from the project wallet; 60 s cooldown)
npm run assemble     # frames → public/capture/take.mp4 at the page's own timing
npm run narrate      # ElevenLabs, only lines not yet generated; pass ids (L05 …) to redo one
REMOTION_BROWSER=<a chrome-headless-shell> npm run render && npm run master   # → out/ripcord-final.mp4
```
The cut re-times itself from the capture's beat marks (`src/timeline.ts`). After a re-shoot, re-read the live loop's numbers off the frame and fix L05 if they changed. Remotion's own Chrome download was missing its ICU data on this machine; Playwright's headless shell works.

## Recorded
- **v2 (submission film):** 2026-11-14, loop #8023, 2 blocks / 2 s (E-023). Length 2:26, under the 3:00 limit. `internal/film/film/ripcord-master.mp4`. Its 12-tile contact sheet was compared with Warrant's before the final render: no repeated neighbouring tiles, the hook is on screen by 0:10, no silences over 0.35 s.
- v1 (fallback): 2026-11-14, take 3, loop #8022, 2 blocks / 2 s (E-022). Length 2:15. `video/out/ripcord-final.mp4`.

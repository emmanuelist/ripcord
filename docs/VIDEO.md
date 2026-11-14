# Ripcord: the video cut

**Thesis (C-1), the first and last thing on screen:** *Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.* (testnet, 50 of 50 loops)

Judges see only this video (DOSSIER: no live demo is mentioned), so the video is the demo. Limit: under 3:00. Target: **2:40**, leaving 20 s of margin.

## How it's made
- **Footage:** one real capture of the public page, https://ripcord-ashy.vercel.app, at 1920×1080 and 100% zoom, in a clean browser profile with no bookmarks bar and no extensions. `video/capture/` drives the page with Playwright and records it through Chrome's own screencast. While it records, the project wallet sends a real `arm()` and `cross(tokenId)` to RipcordTryout. The script signs through `cast` with the encrypted keystore, so the key never enters Node and nothing about the wallet appears on screen.
- **The core take is continuous:** ARMED → BOARDING → DEPARTED runs at chain speed, uncut and not sped up. The wait is the proof. Cuts happen only between beats, never inside a loop.
- **Captions and timing are composed in code** (Remotion, `video/`), so a UI change means a re-render, not a re-shoot. Overlays only label what the page shows. Nothing animates that the app doesn't do.
- **Narration:** ElevenLabs text to speech. The key is read from `.env` and never printed. Every narrated number is read off the frame it plays over. The live loop's numbers (#ID, N s, blocks) are filled in from the capture after it lands.
- **Muted viewers:** the claim, the live loop's result and the refusals each carry an on-screen label.

## Beats

| Time | Screen | On-screen label | Narration | Claims |
|---|---|---|---|---|
| 0:00–0:12 | Live page, top: hero and featured departure | The thesis, verbatim, with "Testnet · 50 of 50 loops" (on screen by 0:03) | "A Uniswap v4 position has no stop. Getting out is a transaction, and somebody has to send it." | C-25, C-1 |
| 0:12–0:24 | Same frame, holding | "Arm once. Reactive watches. The vault exits." | "Ripcord arms a line on your position once. A Reactive contract on Lasna watches every swap in the pool, and pulls your liquidity out when a swap crosses the line." | C-14, C-6, C-7 |
| 0:24–1:12 | **One continuous take.** The arm lands and the page features position #ID as ARMED; the cross swap → BOARDING; the exit → DEPARTED | "Live · not sped up". Then the tx label from each real receipt, "arm() #ID", "cross() swap", "exit" | "This is a real loop, right now. One call arms a line one tick spacing from the price… then a swap crosses it." (silence while it boards) "Out. N seconds on Unichain's clock, from the swap to the exit. Nothing of the owner's ran: Reactive's relayer sent the exit." | C-35, C-13, C-8 |
| 1:12–1:32 | Replay this departure: the ruler of real blocks | "The three hops, each with its transaction" | "The replay shows its three hops at chain speed: the swap on Unichain, the reaction on Lasna, the exit back on Unichain." | C-36 |
| 1:32–2:05 | The refusal room, strips A → B → C | "What it refuses", then HELD / REVERTED / CANCELLED | "What it refuses matters as much. A swap that stops short: Lasna reacts and asks for nothing. An exit called by anyone but Reactive's callback proxy: the chain reverts it. An owner who revoked approval: the ripcord pulls, and the vault records the refusal on-chain instead of touching the NFT." | C-20, C-21, C-22, C-23 |
| 2:05–2:27 | The board, then the "why the seconds matter" note | "50 of 50 within 3 s" | "Fifty measured loops, all within three seconds. On Reactive's previous version blocks came every seven seconds. In the worst half hour of last October's crash, ETH fell a median twenty-five basis points in seven seconds, and fifteen point seven in three." | C-27, C-37 |
| 2:27–2:40 | Back to the top of the page | The thesis, verbatim. The limits line: "Testnet only · not audited" | "Testnet only, not audited. Your Uniswap v4 position leaves the pool within three seconds of crossing your line, with nothing of yours running." | C-11, C-1 |

## Never on screen
`.env`, the keystore, the password file, any private key or seed phrase, any terminal session, or a browser profile with history, bookmarks or notifications.

## Deliberately not in this video
- An architecture diagram or slide. The page's own "How a ripcord pulls" section covers it, and the README links the source lines.
- The team, a roadmap, mainnet plans, or any yield, return or price figure beyond C-2's crash data.
- The read-only `cast` checks and the test suites. Those are in the README, where a judge can run them.
- The contracts table and custody section. They're on the page, one scroll away.
- Phone layout.

## Before upload
- [ ] Claims check: every narration line above maps to a `verified` row, re-checked against live state the day it's recorded
- [ ] Narrated numbers match the frames they play over (#ID, N s, the fifty loops, the crash figures)
- [ ] Length under 3:00 (target 2:40)
- [ ] One throwaway take recorded and watched first
- [ ] Uploaded as unlisted / anyone-with-the-link; played in a private window, logged-out, start to finish
- [ ] Linked in the README and the submission; new claims rows added for anything the video says that isn't already a row

## Rebuild
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
2026-11-14, take 3: loop #8022, 2 blocks / 2 s (E-022). Length 2:15.

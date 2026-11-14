# Ripcord: live demo run of show

**Thesis in one line:** *Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.* (testnet, 50 of 50 loops)

Judging is from the video (docs/VIDEO.md). This script is for a finalist call or live Q&A, if one happens. Target about 3 minutes. Every value on screen is read from the chain.

## Pre-flight
- [ ] https://ripcord-ashy.vercel.app open in a clean window at 100% zoom; console clean (no 413, 429 or CORS errors); all positions loaded
- [ ] RipcordReactive lREACT covers the demo: the service strip shows "N EXITS" (top up with `contracts/script/fund-lreact.sh` if it's under 20)
- [ ] RipcordTryout open, and no arm() in the last 60 s (cooldown)
- [ ] The project wallet holds Unichain Sepolia ETH for two transactions. Sign from a terminal that is **not** shared, with the keystore, never a raw key
- [ ] Tabs pre-opened: Uniscan for RipcordTryout, the Lasna explorer for RipcordReactive, the README
- [ ] Backup: the recorded video, and #8016's departure (`?position=8016`) for the replay

## Cold open: the problem (0:00–0:20)
> "A Uniswap v4 position has no stop. Getting out is a transaction, and somebody has to send it, usually a bot you keep running."

## Act 1: the feel (0:20–1:30)
1. Send `arm()` to RipcordTryout. The page features the new position as **ARMED**.
   > "One call armed a line one tick spacing from the price. From here, nothing of mine runs."
2. Wait about 5 s for Lasna to start tracking the line, then send `cross(tokenId)`. **BOARDING**, then **DEPARTED**. *Slow down here. Let it land.*
   > Read the seconds off the departure: "Out, N seconds on Unichain's clock after the swap."
3. **The reversal:** scroll to *What Ripcord refuses.*
   > "A swap that stops short gets no callback. A direct call to exit reverts. An owner who revoked approval gets a refusal recorded on-chain, not a broken position."

## Act 2: it's real (1:30–2:30)
- Click the departure's swap, Lasna and exit hashes. Each opens on its explorer.
- Click *Replay this departure* to show the three hops at chain speed.
- Board: fifty measured loops, all within 3 s. The "why the seconds matter" note: legacy ~7 s blocks against Omni's ~1 s.

## Close: the thesis (2:30–3:00)
> "Testnet only, not audited, at most eight lines per pool. Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running."

## If something breaks
- The tryout is cooling down → wait out the 60 s with the replay of #8016, then arm.
- The page doesn't show the new position within 15 s → the public RPC is lagging. Open the cross tx on Uniscan and the RipcordReactive Lasna tx; the page catches up on its next poll.
- An RPC returns 413/429 → don't reload, that extends the limit. Switch to the recorded video at the same beat.
- Wifi dies → the recorded video.

---
version: 1
slug: "web-src-app-tsx"
primary_target: "web/src/App.tsx"
related_targets: ["web/index.html"]
---

# Ripcord console (web/)

Mode: Operate (live console), with a Read-mode explainer below the fold.
Audience: Reactive team judges (watching a video under 3 min, then the link) and future Uniswap v4 LPs, weighted equally. Read-only: no wallet.
Task: see a real position's line against the live pool tick and its status; watch a crossing swap flip it to DEPARTED with its block count; open every transaction behind it.
Proof: every value read from chain. History comes from an evidence index of tx hashes (receipts fetched live), and new runs appear live via block polling.
Constraints: Vite + React + TS + viem, static on Vercel (D-013, D-014); at most ~1 req/s per chain; WCAG AA; reduced motion respected; self-hosted fonts; no N in the thesis until C-1 is verified.
Memorable moment: the status flaps turning over to DEPARTED, then "2 BLOCKS".

## Direction contract

THESIS: Every armed position is a scheduled departure on a split-flap board; the swap that crosses its line flips it to DEPARTED and the board counts the blocks. It refuses the DeFi dashboard of rounded cards, range bars, and pills.

OWN-WORLD: Station-board housing: graphite #16171a ground, flap charcoal #2a2c31 tiles with a hinge line, flap-white #f3efe4 characters, Solari yellow #f2c230 for headers and ARMED, departure green #3fbf7f, cancelled red #e2533b, each always paired with its word. Condensed grotesk flap type, tabular numerals, mono only for hashes. Hairline aluminium rails, no shadows, no glass, no gradients.

STORY: The visitor sees the live tick, the line, and the board; understands that a swap crossing the line makes the position depart in a counted number of blocks with nothing of the owner's running; believes it because every row links its swap, Lasna reaction, and exit; scrolls for how it works, custody, and limits.

FIRST VIEWPORT: 60px shell bar (RIPCORD flap wordmark left, section links, live Unichain and Lasna block heights, Read-only tag right). Lead strip at display scale: the pool tick now against the nearest armed line (left), the last exit's block count (right). Below it, the board as a sortable table across the left ~70%. Right rail ~380px: the selected loop's three hops on one fixed whole-block scale, with explorer links. No primary CTA: the board is the action.

FORM: Departure Board, my own grounded candidate 7 of 7, dealt by the roll. Raises: scale-only hierarchy (Variable Font Specimen); one fixed block scale (Botanical Folio); length equals duration (Labanotation); latency in whole blocks (Emigre Bitmap); every run on one sheet, no pagination (Convention Circle Catalog). seed:98299b030bb165d0

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

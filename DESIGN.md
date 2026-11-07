---
name: Ripcord
description: A split-flap departure board for Uniswap v4 positions that leave the pool when a swap crosses their line.
colors:
  housing: "#16171a"
  panel: "#1b1c20"
  row: "#1e1f24"
  row-sel: "#24262c"
  flap: "#2a2c31"
  flap-top: "#2f3137"
  gap: "#0e0f11"
  hinge: "#121316"
  rail: "#2c2e35"
  alu: "#3a3d45"
  ink: "#f3efe4"
  ink-2: "#c3bfb4"
  ink-3: "#9a968c"
  ink-dim-flap: "#aca89d"
  yellow: "#f2c230"
  amber: "#f0953a"
  green: "#3fbf7f"
  red: "#e2533b"
typography:
  display:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(40px, 4.5vw, 74px)"
    fontWeight: 700
    lineHeight: 0.98
    letterSpacing: "-0.012em"
  headline:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "clamp(30px, 3vw, 44px)"
    fontWeight: 700
    lineHeight: 1.05
    letterSpacing: "-0.005em"
  title:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1.3
  flap:
    fontFamily: "Barlow Semi Condensed, Arial Narrow, sans-serif"
    fontSize: "24px"
    fontWeight: 600
    lineHeight: 1
    fontFeature: "tnum"
  body:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "16px"
    fontWeight: 400
    lineHeight: 1.5
  lede:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "clamp(17px, 1.35vw, 20px)"
    fontWeight: 400
    lineHeight: 1.45
  label:
    fontFamily: "Barlow, system-ui, sans-serif"
    fontSize: "12px"
    fontWeight: 600
    lineHeight: 1.5
    letterSpacing: "0.1em"
  mono:
    fontFamily: "JetBrains Mono Variable, ui-monospace, monospace"
    fontSize: "0.82em"
    fontWeight: 400
    letterSpacing: "-0.01em"
rounded:
  hairline: "1px"
  plate: "2px"
  tile: "0.06em"
  tile-s: "0.1em"
spacing:
  pad: "clamp(16px, 2.2vw, 32px)"
  row-y: "18px"
  row-x: "clamp(18px, 1.8vw, 26px)"
  cell: "11px 12px"
  section: "72px"
components:
  flap-tile:
    backgroundColor: "{colors.flap}"
    textColor: "{colors.ink}"
    typography: "{typography.flap}"
    rounded: "{rounded.tile}"
    width: "0.74em"
    height: "1.16em"
  departure-unit:
    backgroundColor: "{colors.panel}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "18px clamp(18px, 1.8vw, 26px)"
  button-replay:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.housing}"
    rounded: "{rounded.plate}"
    padding: "12px 16px"
  button-replay-playing:
    backgroundColor: "transparent"
    textColor: "{colors.yellow}"
  chip:
    backgroundColor: "transparent"
    textColor: "{colors.ink-2}"
    typography: "{typography.label}"
    rounded: "{rounded.plate}"
    padding: "9px 12px"
  chip-pressed:
    backgroundColor: "{colors.yellow}"
    textColor: "{colors.housing}"
  board-row:
    backgroundColor: "transparent"
    textColor: "{colors.ink}"
    padding: "11px 12px"
  board-row-hover:
    backgroundColor: "{colors.row}"
  board-row-selected:
    backgroundColor: "{colors.row-sel}"
  cite:
    backgroundColor: "{colors.hinge}"
    textColor: "{colors.ink}"
    rounded: "{rounded.plate}"
    padding: "14px 16px"
  shell:
    backgroundColor: "{colors.housing}"
    textColor: "{colors.ink-2}"
    height: "60px"
    padding: "10px clamp(16px, 2.2vw, 32px)"
---

# Design System: Ripcord

## Overview

**Creative North Star: "The Departure Board"**

Ripcord's page is a station departure board. Every armed Uniswap v4 position is a scheduled departure; the swap that crosses its line flips its status flaps to DEPARTED, and the board counts, in whole Unichain blocks, how long the exit took. That is the thesis the world serves: a position leaves the pool seconds after a crossing swap, with nothing of the owner's running, and the board makes that visible as a station would. Each departure's swap, Lasna reaction, and exit are named and linked on the board, the way a board names its calling points (`web/src/components/Departure.tsx`, `Board.tsx`).

The material is a graphite station housing with split-flap tiles: flat paint, two flat halves per tile with a real hinge gap, hairline aluminium rails between rows, and nothing else. Depth comes from paint steps (housing, panel, row, flap), never from shadow, glass, or gradient (`web/src/styles.css` header comment and `:root`). Hierarchy is carried by scale: the same flap tile appears at four sizes, from the 17px board cell to the 68px status word. The density is that of an operating console in the first two screens, then a reading page below the fold. The explainer keeps the board's grammar: flaps inline in headings, rails between steps, and source lines cited beside the prose.

Every value on screen is read from chain. The design has no placeholder state that looks like data: an unread value is a row of blank tiles in the dim tone, and an empty board says so in a sentence.

**Key Characteristics:**
- Split-flap tiles as the signature: two flat halves, a hinge gap, a real two-half fall on a real state change only.
- Flat paint on a graphite housing; hairline aluminium rails in place of cards and shadows.
- Every state colour is paired with its word.
- Condensed grotesk for flaps and display, a plain grotesk for reading, mono only for data that is literally code.
- Length equals duration: one fixed ruler of real Unichain blocks.

## Colors

A dark, warm-neutral station housing with one Solari yellow and three signal colours, each always carrying its word.

### Primary
- **Solari Yellow** (#f2c230): header ink of the board (column heads, `.dep-label`, `.svc-label`, `.cite-k`), the ARMED status, the line readout, the SWAP lamp and swap cell of the ruler, the hero's "crosses your line", the Replay button fill, a pressed filter chip, focus outlines, link underlines (70% mix at rest, full on hover), and text selection.

### Secondary
- **Departure Green** (#3fbf7f): DEPARTED, the EXIT lamp, the lit ruler cells from swap to exit, the green block count, "In service" funding, and the "Live" liveness word.
- **Boarding Amber** (#f0953a): BOARDING (Lasna has reacted and the exit is not yet on Unichain), the REACT lamp, "Low" funding, and the "Stale" and "Connecting" liveness words. It is not in the contract's palette; the build added it for the in-between state, and it obeys the same word rule.
- **Cancelled Red** (#e2533b): CANCELLED, the "Refused" stop and ruler cells, "Unfunded" funding, "RPC unreachable", and the inline `.warn` lines ("Vault approval missing: this exit will fail").

### Neutral
- **Station Housing** (#16171a): page ground, the shell bar, and dark text on yellow fills.
- **Panel Graphite** (#1b1c20): the departure unit's face.
- **Row Hover** (#1e1f24) and **Row Chosen** (#24262c): the only fills a board row ever takes, on hover and when it is the featured departure.
- **Flap Charcoal** (#2a2c31): the lower half of every tile, unlit lamps, and unlit ruler cells.
- **Flap Upper** (#2f3137): the upper half of every tile, one flat step lighter because it faces the hall light.
- **Hinge Gap** (#0e0f11): the line across every tile at its split, drawn above the glyph and above a falling half.
- **Hinge Black** (#121316): the ground of a cited source line (`.cite`).
- **Rail** (#2c2e35): hairlines between board rows, explainer steps and contract rows; the unlit route line; the Read-only plate border.
- **Aluminium** (#3a3d45): the structural hairline. It draws the shell's bottom edge, the departure unit's border and inner rails, the service strip, the chip outlines, and the table header rules.
- **Flap White** (#f3efe4): primary ink, flap characters, values.
- **Ink 2** (#c3bfb4): reading prose and secondary values.
- **Ink 3** (#9a968c): metadata, chain names, unlit stop names, and dim prose.
- **Ink Dim on Flap** (#aca89d): dim characters on a flap tile (DISARMED, blank-reading values; `.flap.tone-dim`). Ink 3 on the small tile measured 4.0–4.4:1; this clears AA on both halves (5.0:1 on #35373d, 5.5:1 on #2f3136).

### Named Rules
**The Word-and-Lamp Rule.** A state colour never appears without its word beside it: ARMED in yellow, BOARDING in amber, DEPARTED in green, CANCELLED in red, DISARMED in dim ink, and for funding "In service", "Low" and "Unfunded" in the same three signal colours (`statusTone` in `chain/model.ts`, `stateTone` in `Board.tsx`). Lamps, chip dots and ruler cells are lit only next to their label.

**The Hall Light Rule.** Depth is a flat paint step, never a blend. The upper flap is one step lighter than the lower; a chosen row is one step lighter than a hovered one. `color-mix` is used only to tint a flat line (a lit route segment, a link underline), never to fade.

## Typography

**Display Font:** Barlow Semi Condensed (with Arial Narrow), weights 500/600/700, self-hosted via @fontsource
**Body Font:** Barlow (with system-ui), weights 400/500/600
**Label/Mono Font:** JetBrains Mono Variable (with ui-monospace)

**Character:** a station-board condensed grotesk for everything that is announced, and its wider sibling for everything that is read. Mono is reserved for strings that are literally machine text.

### Hierarchy
- **Flap** (600, line-height 1, tabular numerals): every tile. Four sizes: `s` 17px (board cells, service strip, inline step flaps, wordmark; 15px in the phone board), `m` 24px, `l` 40px (departure readouts; 32px under 760px), `xl` clamp(44px, 4.4vw, 68px) (status word and block count; 40px under 760px).
- **Display** (700, clamp(40px, 4.5vw, 74px), 0.98): the hero claim only, balanced, with one phrase in yellow. Under 760px it becomes clamp(36px, 10.5vw, 48px).
- **Headline** (700, clamp(30px, 3vw, 44px), 1.05): explainer section headings. The board title "Departures" uses the same face at clamp(30px, 3vw, 40px), line-height 1.
- **Title** (600, 24px, 1.3): the three step headings in "How a ripcord pulls", each starting with an inline flap. Route stop names (SWAP / REACT / EXIT) are 700, 20px, uppercase, tracked 0.04em. Contract names in the table are 600, 18px.
- **Body** (400, 16px, 1.5): prose capped at 62ch in the explainer, 44 to 52ch in the hero. The hero lede is clamp(17px, 1.35vw, 20px).
- **Label** (600, 11 to 13px, uppercase, tracked 0.06 to 0.1em): field and column labels in yellow (12px, 0.1em); service labels and the ruler's "Swap" / "Exit" marks at 11px; chips and liveness at 13px.
- **Mono** (0.82em, -0.01em): transaction hashes and addresses (`.hash`), cited source lines (13px, ligatures off), the "This loop" evaluations (12.5px), token tickers (`.ticker`, kept in their own case so lREACT never reads as LREACT), and ruler block numbers (11px).

### Named Rules
**The Machine-Text Rule.** Mono appears only on strings a machine produced or reads: hashes, addresses, source code, token tickers, block numbers. Never on headings, labels or prose.

**The Drawn-Glyph Rule.** Barlow Semi Condensed has no ≤ or ≥, so the flap draws them as SVG chevrons in its own ink and weight (`Glyph` in `Flap.tsx`). A missing glyph is drawn, never substituted from a fallback face.

## Layout

The page is three bands on the housing, divided by aluminium hairlines: the hero (claim beside the featured departure), the board, and the explainer. Horizontal inset is one fluid token, `--pad` (clamp(16px, 2.2vw, 32px)), used by the shell, hero, board section, and explainer.

- **Hero:** two columns at 0.8fr / 1fr (about 44/56), gap clamp(28px, 4vw, 64px). At 1100px and wider it has a min-height of the first screen less the shell (capped at 960px), so the board starts whole at the fold instead of being cut through.
- **Departure unit rows:** 18px by clamp(18px, 1.8vw, 26px) padding, an aluminium rail between rows; the status row is 16px block padding.
- **Board:** a full-width table; cells are 11px by 12px; rows sit on rail hairlines. The service strip sits right of the title.
- **Explainer:** 72px top padding and 72px between sections. The "How" steps are two equal columns (text, cited lines). Custody and Limits use a split layout: heading at minmax(220px, 1fr), body at 2fr, with a rail above.

**Responsive decisions (what changes):**
- **Under 1100px:** the hero stacks, with the claim above the departure (copy capped at 760px). The shell drops the Lasna block height and keeps Unichain's. The board head stacks, putting the service strip under the title. The explainer step's cited lines drop under its text.
- **Under 760px:** the shell wraps, and the section links become a full-width scrolling third row; block heights and the Read-only plate are dropped, while liveness stays. The route turns vertical: stops run down the unit and the line drops from lamp to lamp. Replay becomes full width. The service strip becomes one cell per row on its own rail, nothing clipped. Split explainer sections stack. Scroll margins grow (116px for the departure, 100px for the board) because the header is two rows tall.
- **Board container under 640px:** each departure becomes a three-line row on its rail, not a key/value card. Line 1 is position, status and blocks; line 2 is time and date, then the exit hash; line 3 is the line, then the swap tick, with small "Line" / "Swap" labels shown only here.
- **Contracts container under 560px:** the table becomes stacked blocks, one contract per rail.

## Elevation & Depth

This system has no shadows, no blur, no glass and no gradients. Depth is conveyed in three ways. First, flat tonal steps: housing, then panel, then row, then flap. Second, aluminium and rail hairlines (1px) that separate rather than lift. Third, the split-flap's own construction: a lighter upper half, a darker lower half, and the hinge gap between them. The only non-flat paint is transient. During a turn, the falling half dims (brightness 1 to 0.5) and the landing half starts bright (1.3 to 1), which reads as the half catching the light as it swings. It lasts 65 ms and is gone at rest.

### Named Rules
**The Flat Paint Rule.** Surfaces are flat at rest and stay flat in every state. Hover and selection change paint, never elevation.

## Shapes

The geometry is rectangular and nearly sharp. Plates, the departure unit, chips, the Replay button, cited lines, the service strip and the Read-only plate all use a 2px radius. Ruler cells use 1px. Flap tiles use a radius relative to their font size, 0.06em at the default sizes and 0.1em at `s`, so the corner scales with the tile. Round forms are reserved for lights: route lamps (14px), the liveness dot (8px), and the chip and funding state dots (7px) are circles because they are lamps on the board, not decoration. Lines are hairlines: 1px rails, a 2px route line, 2px focus outlines in yellow offset by 2 to 3px.

## Components

### Flap (signature)
A row of split-flap tiles (`Flap.tsx`, `flapSteps.ts`, `.tile` in `styles.css`). It is used for every value the board announces: position, ticks, line, status, block count, time, funding coverage, and the wordmark.
- **Construction:** each tile is 0.74em × 1.16em (0.8em × 1.36em at `s`, with the `s` size's own lighter paint pair). It is painted as two flat halves, the upper half in Flap Upper and the lower in Flap Charcoal, with the Hinge Gap line (max(1px, 0.045em)) across the middle above everything. Blank tiles take a darker pair. Glyphs use tabular numerals; a space renders as a blank tile.
- **The turn:** each step is a real two-half fall. The old upper half falls over the hinge in 65 ms (ease-in, cubic-bezier(0.55, 0, 1, 0.45), rotateX 0 to −90°). Then the new lower half lands in 65 ms (cubic-bezier(0.2, 0.7, 0.3, 1), from 90° through a −2° settle to 0). One step is 130 ms, tiles stagger by 40 ms, and a tile shows at most 6 intermediate steps, always turning forward through the drum (space, A–Z, 0–9, then − + . : #). A tile turning between two numeric characters uses a digit-only drum (space, 0–9, − : # ,), so a number never shows a letter mid-turn.
- **When it turns:** only when its text changes as a result of a real state change. It never turns on first render, and under `prefers-reduced-motion: reduce` it never turns at all (the fall layer is not rendered). Screen readers get the final text, never the flapping.
- **Glyphs:** ≤ and ≥ are drawn as SVG chevrons (stroke 1.45, square caps) because the face lacks them.

### Departure unit
The featured departure (`Departure.tsx`, `.departure`): a panel-graphite plate with an aluminium border and rails between its four rows.
- **Readouts row:** Position, the tick ("Pool tick now" while armed and live, "Swap tick" otherwise) and the line ("Line · exit at or below/above", in yellow), each a yellow field label over an `l` flap.
- **Status row:** the status word at `xl` in its tone.
- **Calling at:** three stops (SWAP · Unichain Sepolia, REACT · Reactive Lasna, EXIT or REFUSED · Unichain Sepolia), each with a 14px lamp that lights yellow, amber, then green or red as its hop lands. The line between two lit stops tints yellow. Under each stop are its chain and block number, what happened, and its explorer hash. Each stop reserves room for three lines, so the unit never changes height mid-replay. Unlit stops show what is waiting: headroom in ticks, or the contract name.
- **Swap to exit:** the block count at `xl` ("2 BLOCKS"; green, or red when refused; blank dim tiles until known) beside the Replay control.
- **Ruler:** one fixed scale of 8 real Unichain blocks from the crossing swap. The swap cell is yellow and labelled "Swap"; cells up to the exit light green, with "Exit" on the last (red with "Refused" when the exit was refused). Each cell carries the last three digits of its own block number. The note under it states the block range, the seconds on Unichain's clock, and the scale, and says so when a loop runs past the scale.
- **Loading:** a 540px plate with one sentence ("Reading the latest departure from Unichain Sepolia and Lasna…"), never placeholder values.

### Replay control
A yellow-filled 2px plate, 600 15px Barlow, padding 12px 16px, with a play-triangle SVG. Hover lightens the fill one step; pressing nudges it down 1px (120 ms). While it plays, the button keeps its yellow outline with a transparent fill and yellow text, the icon becomes a steady square, and the label reads "Replaying at chain speed". There is no spinner.

### Board
`Board.tsx`: the "Departures" table on rails.
- **Columns:** Time UTC, Position, Line, Swap tick, Status, Swap → exit, Exit tx. Every value cell is an `s` flap, except hashes in mono and "—" in dim ink for values that do not exist yet. Column heads are yellow labels. Sortable heads carry an authored two-chevron SVG mark (`SortMark.tsx`, 1.5px stroke) that dims the inactive direction.
- **Rows:** transparent on a rail hairline. The hovered row takes Row Hover and the featured row takes Row Chosen, with no other fills. Clicking a row features it and brings the departure unit into view. An armed row whose approval is gone, or whose contracts are unfunded, carries an inline red sentence.
- **A refused row never reads as an exit:** under its CANCELLED flap, the decoded reason ("Refused: …") in red; the block count stays a red flap with "to the refusal" beneath it; the tx cell reads "refusal" before the hash. Rows the refusal room reads back carry "Read back in the refusal room", on its own line, linking to that attempt.
- **Phone rows** (container under 640px): three lines on the rail: position · status (with any reason beneath) / time and date · blocks / line · swap tick · tx.
- **Filter chips:** rectangular 2px outlined plates in uppercase 13px labels with counts. A status chip carries its tone's dot beside its word. A pressed chip fills yellow with housing ink. "All" and "Armed" always show; other states appear only once a position holds them.
- **Empty and loading:** one full-width sentence row, never placeholder rows.

### Service strip
`.svc`: three cells in an aluminium-outlined plate with hairline dividers. "Pool tick now" is an `s` flap that turns on every swap. Each funding cell (RipcordReactive · lREACT, RipcordVault · ETH) shows how many exits its balance covers as an `s` flap, the state word with its dot ("In service" at 3 or more, "Low" below 3, "Unfunded" below 1), and the balance, linked to the explorer. A note under it names the pricing basis: the cost of the last real loop, by position number.

### Explainer
`Explainer.tsx`: the reading half, in the board's grammar.
- **How a ripcord pulls:** three steps on rails. Each heading begins with an inline `s` flap (SWAP / REACT / EXIT in yellow) sharing the heading's first line. Inline layout is deliberate, so the flap never stands above the heading. Beside each step are cited source lines: a hinge-black plate with mono code, an optional "This loop" evaluation of that line in one real recorded loop, and a file:line link pinned to the deployed commit. Under each step's prose, a "recorded" line gives the hop's block and hash.
- **What you give, what you keep:** prose with a "Read now" fact, which is the NFT owner read live from the PositionManager, the block before the exit and now.
- **Limits:** a list with 10 × 2px yellow bars as markers, including live facts ("N of 8 armed now", the exits the reactive contract covers).

### Refusal room
`Refusals.tsx`, `chain/refusals.ts`: "What Ripcord refuses", between "How a ripcord pulls" and "What you give, what you keep". Three real attempts (E-016), each rebuilt on load from its own transactions by hash; the page stores no value.
- **Each attempt** sits on the explainer's rails (`.flow > li`, anchors `refusals-a/-b/-c`). Its heading begins with an inline outcome flap: **HELD** in yellow (the line stayed armed), **REVERTED** and **CANCELLED** in red. These are outcomes of an attempt; CANCELLED is also the board state of the same event.
- **The narrative** is built only from live values: ticks from the Swap event and StateView one block earlier, the reaction's charge from historical balances, the block gap to the refusal.
- **A calling-at strip per attempt** (`.route-strip`, the departure's own `Stop`): A lights SWAP and REACT and leaves EXIT dark ("no callback requested"); B leaves SWAP and REACT dark ("none: nothing crossed", "none: Lasna never asked") and lights only a red REVERTED; C lights SWAP, REACT and a red REFUSED, with the departure's `Ruler` underneath ending in the red REFUSED mark. The lamp that stays dark is the proof.
- **What the chain says now** (`.chain-says`): a hinge-black plate with a yellow label ("Read back now", "The chain's reason", "The vault's record") over facts on rails: the decoded error in mono (the reverted call replayed one block earlier; the vault's ExitFailed reason), a plain "Means" line, the position's status now as a flap, and liquidity "before · now · unchanged".
- **Loading or RPC failure:** one sentence, never placeholder attempts.
- **Contracts:** a table on rails with names in the display face and addresses in mono.

### Shell
`Shell.tsx`: a sticky 60px housing bar with an aluminium bottom edge. It holds the RIPCORD wordmark as a yellow `s` flap; section links in Ink 2 (500), which on hover turn ink with a 2px yellow underline; live Unichain and Lasna block heights; a liveness word with its dot (Live green; Stale · N s or Connecting amber; RPC unreachable · retrying red); and an outlined "Read-only" plate. Below 760px the links sit on their own line and "How it works" is dropped (the hero links "How a ripcord pulls"), so the four that remain fit at 390px without a hidden scroll strip.
- **Polling:** both chains every 1.5 s (10 s while the tab is hidden). A failed poll backs off 1.5 → 3 → 6 → 12 → 24 → 30 s; the first success, or the browser's `online` event, snaps back.

### Motion inventory
- **Flap turn:** 130 ms per step (65 ms fall plus 65 ms land), 40 ms stagger, at most 6 steps.
- **Lamp:** background and border colour change over 160 ms.
- **Replay button:** 120 ms colour and press nudge.
- **Replay timing:** a 0.8 s lead-in with every hop withheld and the status ARMED. Then the swap lands, Lasna reacts at the halfway mark, and the exit lands at the loop's own Unichain seconds (from the swap and exit blocks' timestamps), while the block count advances. Then a 1.4 s hold. Lasna's clock skews against Unichain's, so the reaction is staged between the two Unichain hops, and the note says so on screen while the replay plays.
- **Selecting a row:** scrolls smoothly to the departure unit, or instantly under reduced motion.
- **Reduced motion:** flaps show their final text with no fall, and scrolling is instant. Lamp colour changes remain as plain colour changes.

## Do's and Don'ts

### Do:
- **Do** read every value from chain. An unread value is a row of blank dim tiles or one sentence saying what is being read; it is never a placeholder number or row.
- **Do** pair every state colour with its word (ARMED, BOARDING, DEPARTED, CANCELLED, DISARMED; In service, Low, Unfunded), and light lamps and dots only beside their label.
- **Do** announce values as flaps at s/m/l/xl and let them turn only on a real state change, never on first render or under reduced motion.
- **Do** quote latency in whole Unichain blocks on the fixed 8-block ruler, with the seconds on Unichain's clock named as such.
- **Do** make Replay withhold recorded hops until their moment and invent nothing. Say on screen that the Lasna hop is staged.
- **Do** price funding from the last real loop and name its basis.
- **Do** separate with 1px aluminium or rail hairlines and change paint, not elevation, for hover and selection.
- **Do** keep mono for hashes, addresses, code, token tickers and block numbers only.
- **Do** read every refusal back by hash (the revert replayed one block earlier, the reaction's charge, liquidity before and now, status now), and show each attempt in the board's own lamps: a lamp that stays dark says what did not happen.

### Don't:
- **Don't** use gradients, shadows, blur, glass or glows on any surface.
- **Don't** use pills, rounded cards, or radii above 2px on plates. Circles are for lamps and state dots only.
- **Don't** put a kicker or eyebrow above a heading. A designation flap shares the heading's first line.
- **Don't** build a hero-metric template (big number, small label, stat cards); the hero is the claim plus one evidence sentence computed live.
- **Don't** convey a state by colour alone, or show a colour-coded lamp, cell or dot with no word next to it.
- **Don't** render demo, mock or placeholder rows, or state an N-second figure before it is verified.
- **Don't** set ≤ or ≥ in a fallback face; draw them.

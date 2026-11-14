# Ripcord: build rules and pinned context

Your Uniswap v4 position leaves the pool within 3 seconds of crossing your line, with nothing of yours running.

(3 s on Unichain's clock: the exit block's timestamp minus the crossing swap's, 50 of 50 testnet loops, E-019, D-016. Re-check before every publish: one slower loop breaks the sentence.)

**Read `docs/STATE.md` first.** It holds the current truth: what works, what's deployed and what's next. Read `docs/CONTEXT.md` before touching any integration. The research dossier and strategy notes live in `internal/`, which is gitignored and never committed.

Built for the Reactive Omni Buildathon, track **Every Second Counts**. The deadline is 2026-12-05 20:00 UTC.

## How it works (target design)
```
Pool chain (Unichain Sepolia or Base Sepolia)     Reactive Lasna (5318007)            Pool chain
v4 PoolManager emits Swap(poolId, ..., sqrtPriceX96, ..., tick) ──▶ RipcordReactive.react(log)
                                                                    price crossed a user's line?
                                                                    └▶ SYSTEM.requestCallbackV_1_0 ──▶ callback proxy
                                                                                                        └▶ RipcordVault.exit(rc, ...)
                                                                                                           PositionManager.modifyLiquidities
                                                                                                           (DECREASE_LIQUIDITY + TAKE_PAIR)
```
The pool chain is chosen by measurement in M0 (see docs/PLAN.md).

## This is NOT the Reactive Network you know
Reactive moved to **Omni** (CometBFT, ~1s blocks, instant finality). Lasna migrated on 2026-10-07 and mainnet on 2026-10-28. Most examples online, including Reactive's own `reactive-smart-contract-demos`, are **legacy**: `vm` modifier, ReactVM, `emit Callback(...)`, system contract `0x…fffFfF`, `reactive-lib`. None of that applies here.

- Use **`reactive-lib-omni` v0.1.0** only. **The legacy `reactive-lib` must never appear in this repo.**
- The system contract is `0x8888888888888888888888888888888888888888`. `react()` is `onlySystem`.
- Callbacks go through `SYSTEM.requestCallbackV_1_0({chainId, recipient, gasLimit, payload})`. Never use `emit Callback`.
- Callback receivers guard on `onlyCallbackSender(address)`, using the address Reactive writes into the first payload argument.

Exact signatures and addresses are in docs/CONTEXT.md. Don't re-derive them, and never trust training data over them.

## Repo layout
```
contracts/   Foundry project: src/, test/, script/ (libs as git submodules in contracts/lib)
harness/     latency harness: TypeScript + viem, records each loop hop [M1]
web/         frontend: reads chain state only [M1]
docs/        STATE, PLAN, DECISIONS, EVIDENCE, CONTEXT (see the protocol below)
internal/    research dossier, strategy, submission draft: gitignored, never commit
```
Imports use the remappings in `contracts/remappings.txt`: `reactive-lib-omni/`, `@uniswap/v4-core/`, `@uniswap/v4-periphery/`, `permit2/`, `forge-std/`. Only `contracts/` exists today. `harness/` and `web/` are scaffolded in M1, and their versions get pinned then (D-005).

## Pinned versions
Looked up on 2026-11-06, never from memory. Re-check before any upgrade.

| | Pinned | Notes |
|---|---|---|
| Foundry | **1.8.3** | 1.9.0 shipped 2026-11-02. The gate's exit codes were verified on 1.8.3; revisit at M1 (D-003) |
| solc | **0.8.38** (latest release) | Our sources declare `^0.8.29`, the floor set by reactive-lib-omni |
| EVM target | **cancun** | Conservative across Lasna, Unichain Sepolia and Base Sepolia; v4 itself targets cancun. Lasna acceptance is verified by spike S1 |
| reactive-lib-omni | **v0.1.0** (`3ade0dcf1d27`) | The only tag, equal to master on 2026-05-21 |
| forge-std | **v1.17.0** (`f3dae6e6ee38`) | |
| v4-periphery | **`c6e4754dab11`** (main, 2026-10-26) | It has no tags. Every PositionManager selector we call is verified against deployed bytecode (CONTEXT.md) |
| v4-core | **1.0.2** (`59d3ecf53afa`), taken *through* v4-periphery's own submodule | ABI-identical to the deployed v4.0.0 (D-006). Never install a second v4-core |
| Node / TypeScript / viem | provisional: Node 26 LTS, TypeScript 6.0.3, viem 2.57.16 | **TypeScript 7 must not be pinned**: typescript-eslint 8.72.1 accepts only `>=4.8.4 <6.1.0`. Re-check at M1 scaffold |

```bash
curl -s https://binaries.soliditylang.org/macosx-amd64/list.json | jq -r .latestRelease
gh api repos/foundry-rs/foundry/releases/latest --jq .tag_name
curl -s https://nodejs.org/dist/index.json | jq -r '[.[] | select(.lts)][0].version'
npm view typescript-eslint peerDependencies.typescript
```

## Rules
1. **No mocks, no fake data, no demo mode** in anything deployed, rendered or shown in the video. Every value on screen is read from the chain. Test doubles are allowed **only inside `contracts/test/`** (D-004), and never on a path a judge sees.
2. **Verify every contract call before writing it.** Use the interface source at the pinned commit and the deployed bytecode's selectors (`cast sig` + `cast code`). Use `reactive-lib-omni` source for Reactive. If a call can't be verified, stop and say so.
3. **Phase-gated.** Build the current milestone only, then stop for confirmation. Milestones and exit criteria are in `docs/PLAN.md`, and the current one is in `docs/STATE.md`.
4. **Use timestamps, not block counts,** for every timer, cooldown, deadline and latency figure. Base Sepolia produces 200ms blocks (event rule).
5. **Every loop we claim has three hashes:** origin swap, Lasna reactive tx, destination callback. Save the raw receipts in `docs/evidence/`.
6. **Tests cover failure paths.** That means: callbacks not from our reactive contract, a price that doesn't cross, a second exit for the same position, an underfunded contract, and stale or out-of-order events.
7. **No secrets in the repo.** Use env vars only, with blank-valued keys in `.env.example`. The project wallet (D-007) is testnet-only: never send it mainnet funds, never print or screen-record its key or password file, and never move the keystore off this machine.
8. **Never cut scope silently.** Cuts are the user's decision. Present the tradeoff on technical merit (security model, attack surface, latency, composability), not on effort, and record an accepted cut in `docs/DECISIONS.md`.

## Domain rules
- Prices stay as `sqrtPriceX96` (`uint160`) or ticks (`int24`) end to end on-chain. No floats anywhere on-chain. The UI converts at display time only.
- An exit removes liquidity. It never market-swaps without a `minOut`.
- Each position exits at most once. Exits are idempotent per `tokenId`.
- The reactive contract keeps its lREACT balance, and the vault keeps its native balance, above one exit's cost. The UI shows how many exits each balance covers.

## Verification before any gate
Run from `contracts/`. All of it must be green before any milestone closes, and CI runs the same steps on every push.

```bash
forge fmt --check
forge lint --deny warnings     # bare `forge lint` exits 0 even with findings (checked on forge 1.8.3, 2026-11-06)
forge build --sizes
forge test
```

The TypeScript gate (`lint --max-warnings 0`, `typecheck`, `test`, `build`) is added when `harness/` and `web/` exist.

## Where things live
| Concern | File |
|---|---|
| Current truth: what works, what's deployed, what's next | docs/STATE.md (read it first) |
| Time left and current phase | the clock line printed at session start (.claude/hooks/clock.mjs) |
| Milestones, the build window and its checkpoints | docs/PLAN.md |
| Work items | the checklist in docs/PLAN.md (sprint profile) |
| Why we chose what we chose | docs/DECISIONS.md (append-only) |
| Proof that things work, and every public claim it backs | docs/EVIDENCE.md (raw captures in docs/evidence/) |
| Verified facts about dependencies, and traps | docs/CONTEXT.md. Read it before touching any integration |
| Demo script, video script, submission draft | docs/RUNOFSHOW.md, docs/VIDEO.md, internal/SUBMISSION.md |
| Research, strategy | internal/ (gitignored) |

## Operating protocol
- **Start:** read docs/STATE.md and the clock line, then the open work items for the current milestone and the last 3 entries of docs/DECISIONS.md. Say the next action back before starting.
- **Work:** one item at a time. Make a small commit to `main` that passes the gate, with the evidence in the commit message.
- **Parallel agents** work only on independent items with their own acceptance criteria, each in its own git worktree, each merged only when its gate is green. Never put two agents on the demo path at once.
- **Before publishing** a post, README change, submission or video: every factual sentence in it has a `verified` row in the claims table in docs/EVIDENCE.md, re-checked against live state today.
- **Finish** (or `/foundation handoff`): append to EVIDENCE and DECISIONS, update CONTEXT and the claims table, close work items with evidence, rewrite docs/STATE.md, commit.
- **Truth rule:** never write a claim into STATE, README, an issue or a commit that wasn't verified this session. Write "unverified" instead.
- **Decisions:** never relitigate an accepted decision without new evidence. Supersede it with a new entry instead.

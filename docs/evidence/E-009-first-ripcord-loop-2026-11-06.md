# E-009 First real Ripcord loop on-chain (2026-11-06)

Deployment (`docs/evidence/m1/deploy.json`):
- RipcordVault (Unichain Sepolia): `0x641413bb227c5452ef2b968c9774bc31f5f54c98`
- RipcordReactive (Lasna): `0xA2deA4D676236Aa905c0Cb1B90712Fc3591af2B5`
- Demo pool (disclosed test tokens RDA/RDB, 0.3%, tickSpacing 60): poolId `0xcd8519fedccc6235e1775b43017dc99d10e3be81b9989bda25d9d4a20aa3d064`

| Step | Tx | Block |
|---|---|---|
| arm(tokenId 7944, line -120, exitBelow true) | `0x604015c248933c5e672fb0e3828f89c629a15719be09516cc33936b3d3496e8e` | 0x4004d7e |
| **swap** through v4 PoolSwapTest: tick 0 → -199 | `0x88dea6df04ee3a74b8b0020a6dc3a5f796930fca73559c74037f5ed6a2031262` | 0x4004d8b |
| **react()** on Lasna → RipcordPulled | `0x86364e500098f45f4a3a854db410345a85201109ac33975afe27e896fe0af892` | 0x7550c2 |
| **exit** via callback proxy → RipcordVault.exit | `0x31a5b83cba4bb5ee28bdadd8b6d4ee8e60a0193443434515754286d09657b119` | 0x4004d8d |

**Result:** position 7944's liquidity 1e21 → **0**. The owner received 269.170667702403216538 RDA and 249.299087358432603550 RDB and kept the NFT. The vault line status is `Exited`.

**Verified independently (cast, 2026-11-06):**
- The relayer `0xF7E8…1DDb` sent the callback to the proxy with a 1,000,000 gas limit, using 220,510. `exit()` itself took 183,855.
- Injected sender = `0xA2de…f2B5` (RipcordReactive), so `onlyCallbackSender` passed on-chain.
- `Exited` event: triggerTick −120, observedTick −199, tickAtExit −199, liquidity 1e21, and originBlock 67128715 + originTxHash equal to **the triggering swap's block and hash**. Each exit is traceable on-chain to its cause.
- **Speed: swap block 67128715 → exit block 67128717, 2 Unichain blocks.** Block timestamps 1793981143 → 1793981145 = **2 s** on Unichain's clock. The Lasna react block is stamped 1793981142, consistent with Lasna's ~1 s clock skew (E-005).
- The Lasna `react()` that fired the line used 106,801 gas, including the unsubscribe after the last line. That supports the cap of 8 lines per pool (D-012).
- `subscribe()` inside `react()` works on Omni: arming made RipcordReactive subscribe to the pool's Swap topic, and the next swap was delivered. Unsubscribing in `react()` works too (the tx succeeded).

**Not evidence:** the shell script's wall-clock times (Lasna seen +15.6 s, exit seen +18.9 s). Each `cast logs` poll costs 1.0–1.5 s and the hops are polled one after another, so those figures measure the poller, not Ripcord. Per-hop wall clock needs the M1 harness.

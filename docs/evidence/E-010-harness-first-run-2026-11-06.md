# E-010 Latency harness, first measured run (2026-11-06)

`harness/` (TypeScript 6.0.3 + viem 2.57.16; gate: eslint 0 warnings, tsc, 14 vitest tests, build). Its encoders match forge's real mint tx and `cast calldata` byte for byte. Signing goes through the encrypted keystore via `cast mktx`; the key never enters Node.

## Method
- Preparation is untimed: mint, approve, arm, then wait until Lasna emits `LineTracked` for the tokenId.
- The swap is pre-signed. Three watchers start before the broadcast: the swap receipt (Unichain), `RipcordPulled` (Lasna), and `Exited`/`ExitFailed` (Unichain), the last two by exact topics.
- Each sighting is bounded. It became visible after the start of the last poll that missed it and by the response of the first poll that saw it. A hop is the interval implied by two sightings.
- **On-chain truth** comes from block numbers and Unichain block timestamps of the swap and the exit. That figure is used for N, because anyone can check it on an explorer.

## Run 1
| | Value |
|---|---|
| tokenId | 7945 (exited) |
| line / direction | -319 / exitBelow true (tick before -199) |
| swap tx | `0x82f67bb74643666ffc105e3626371b6af0906ec09fefdb6f83df64e300f7e790` (block 67129679) |
| Lasna react tx | `0x5784fc4a5a0375750f9ced2df8cdd7cbed79cafef2811d427ca350eeb00cdfc6` (Lasna block 7689290) |
| exit tx | `0x614a6de33ad8b7cb66b6535481cddda1d8459463e7ce556b8c770f3e434fab72` (block 67129682) |
| **on-chain swap → exit** | **3 Unichain blocks, 3 s** |
| wall: swap seen → Lasna seen | [1077, 5138] ms |
| wall: swap seen → exit seen | [3937, 6015] ms |

## Reading it
- The wall-clock bounds are as wide as the polling round trips. Measured uncached RTT over this connection (with VPN): Unichain ~311 ms, Lasna ~460–590 ms, and 1.5–2 s for a first request on a new connection.
- The exit's wall-clock lower bound (3.9 s) exceeds its on-chain 3 s because **public-RPC visibility trails block inclusion**. That's what a user's UI would see, but it isn't Ripcord's latency.
- **Known bug in this run's file:** `rpc.uniPollMs`/`lasnaPollMs` read 0 because viem caches `getBlockNumber` (~4 s), so they're invalid. Fixed right after (raw `eth_blockNumber`). Demonstrated: raw 279–544 ms against cached 0 ms.

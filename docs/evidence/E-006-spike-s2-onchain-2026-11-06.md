# E-006 spike S2 on-chain: Reactive callback exits a real Uniswap v4 position (2026-11-06)

- Position: tokenId **7943** in a v4 pool of disclosed test tokens RTA/RTB (0.3%, ticks ±600) on the live Unichain Sepolia PoolManager/PositionManager
- ExitTriggerSource (Unichain Sepolia): `0x6e9468b5fab6f86ea3964898fcee987c70ac8ab0`
- ExitProbe (Unichain Sepolia, **approved** on the NFT, never its owner): `0x353bcf336d580183bdb4cb377b0c23190707a185`
- ExitReactive (Lasna): `0x27F0B7391B5B66d7Ba14F45bfC9E4CEe50a31710`

| Hop | Tx | Block |
|---|---|---|
| 1. exit requested (Unichain Sepolia) | `0xdaa3ce4622a073f231c1d8a10f7e47f0c60990904abef1c1ad6509d317d73cc8` | 0x400467e |
| 2. react() (Lasna) | `0xd164eeb471d6934cbe922a33618c8d1b90c0fc9697d1a375b4b98061984ec577` | 0x754a14 |
| 3. callback → ExitProbe.exit → PositionManager (Unichain Sepolia) | `0xfc8542879cdb3e2f995500a242dc9a437c7c4c7a90770501806af5892fa9cd0f` | 0x4004680 |

**Result:** liquidity 100000000000000000000 → **0**.

**Verified independently (cast, 2026-11-06):**
- The relayer `0xF7E8…1DDb` sent the callback to the proxy `0x775c…66C1` with a gas limit of exactly 1,000,000 (the requested CALLBACK_GAS). The tx used 183,138 gas; `exit()` inside used 140,003.
- The injected sender was `0x27F0…1710` = ExitReactive, so `onlyCallbackSender` passed on-chain.
- The trace shows `Exited(7943, 1e20, -600, 600)`, then `modifyLiquidities` → `transfer(owner, 2.955e18)` for each token. The owner's balances are back to minted − 1 wei (rounding).
- `ownerOf(7943)` is still the owner: the approve custody model works on the deployed bytecode.
- Origin block 67126910 → callback block 67126912: **2 Unichain blocks**. Wall clock with polling: origin mined → exit seen 4761 ms (upper bound).

Raw: `docs/evidence/s2/exit-7943.json` (all three receipts), plus setup, pool and Lasna broadcasts in `docs/evidence/s2/`.

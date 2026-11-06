# E-005 spike S1 on-chain: Unichain Sepolia → Reactive Lasna → Unichain Sepolia (2026-11-06)

Deployment v3 (CALLBACK_GAS 500k):
- PingSource (Unichain Sepolia): 0xd5342bccbf38c25b2c76a154b28000deabafc31e
- PongSink (Unichain Sepolia): 0xa458e60f62d2964ade804570cedd2f91d3f149c9
- PingReactive (Lasna): 0x35578bDBc23a6DF3543FbeC51D9A28E51AA22097
- Callback proxy: 0x775c9B990ADe401060B78D0e98684eEf8d2466C1

| seq | origin tx (Unichain) | Lasna react tx | callback tx (Unichain) | Unichain blocks origin→callback | block-ts origin→callback | wall clock origin mined→callback seen | injected sender = PingReactive |
|---|---|---|---|---|---|---|---|
| 1 | `0x2942b491efcaea6afcf6212c008728c1e9be9d435aba31b92d333962047839e3` | `0x0924f6414df000dd112336ecbea771c468f3c68d21653032be41a15e83e01fbd` | `0x7746ca4d181a4dda0f7fa199a95d61a00cf41a11e0c3474101c7a3471df247d5` | 2 | 2 s | 4136 ms | true |
| 2 | `0xce28df3b08ba3ef5f40efae3eef00ce516247bff019aedfa9edcab87c71aee96` | `0x7604e0a47636972a1a5c84276206e4a31aa6a38c9dab00e584e8b598019a325a` | `0xa1f9a2291acf74d536ab92d239033e8499bae476bd0db17240b9e25e234f8773` | 2 | 2 s | 4454 ms | true |
| 3 | `0xa00bf099390e44995efa94900db969be9d6964c24a51c3a82c80bc913a4df855` | `0x82280e39087b8c383d7c7ac9fcaf90c26af85760615111fee4226a822ea68325` | `0xa650c38b468f4768a70a4e863a729047d88065877cb6e77651c322a254bfa9a8` | 3 | 3 s | 4783 ms | true |
| 4 | `0x911ba14d20c3b73de7d667f57f232f7c557a405a2ce7f9611a4349ee8c04b583` | `0x89b8af34a89b00e52a837391c45d4b17829aa4034e6aa72d385a208c63c0e4fe` | `0x895880a1a51c871e3774048ed9399c8b91992b7c226379e96946a198e9b80e89` | 2 | 2 s | 3759 ms | true |
| 5 | `0x0ad0e41475e004a747bda59d94e2c8ae21cc9c7396c957f91df8ded271d81009` | `0xdf09289fafbfcc4a415a6c259178bda19fe637b26dac0a7fc565eb65fa22aaa0` | `0x5179a2121ceef461f9d97656a62565c5d47d1a32ae2ce1852a3677ce3cea3b35` | 2 | 2 s | 4491 ms | true |

**Summary:** 5/5 loops delivered. The callback is included 2 Unichain blocks after the origin block (4/5) or 3 blocks (1/5): median **2 s** on Unichain's own clock (1 s resolution). Wall clock with 100 ms polling via cast: min 3,759 / median 4,454 / max 4,783 ms. That's an upper bound that includes per-poll process and RPC overhead.

**Caveats:** Lasna's block timestamps read ~1 s *behind* Unichain's for the same loop (origin→Lasna delta −1 s), so cross-chain timestamp deltas aren't valid for the Lasna hop. Per-hop wall-clock timing needs the M1 subscription harness.

Raw receipts per loop: `docs/evidence/s1/unichain-loop-<seq>.json`. The earlier failed deployment and its out-of-gas trace: `docs/evidence/s1/unichain-v2-*`.

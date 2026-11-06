#!/usr/bin/env bash
# Spike S1 measurement: sends RUNS pings and times each loop hop by wall clock and by block timestamp.
#
#   POOL=unichain ACCOUNT=ripcord-deployer RUNS=5 ./script/spike/s1-run.sh      (run from contracts/)
#
# For every loop it saves the three raw receipts (origin ping, Lasna reactive tx, pool-chain callback) plus timings
# to ../docs/evidence/s1/<pool>-loop-<seq>.json. Wall-clock times come from polling every POLL_MS (default 100), so
# each figure carries up to about one poll interval plus one RPC round trip of error. The M1 harness uses
# subscriptions instead.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f ../.env ] && set -a && . ../.env && set +a
: "${POOL:?set POOL=unichain or POOL=base}"; : "${ACCOUNT:?}"; : "${LASNA_RPC:?}"
RUNS=${RUNS:-5}; POLL_MS=${POLL_MS:-100}; TIMEOUT_S=${TIMEOUT_S:-90}
[ "$TIMEOUT_S" -le 150 ] || { echo "TIMEOUT_S over 150 s can exceed the 1000-block log range on Base Sepolia" >&2; exit 1; }
DEPLOY="../docs/evidence/s1/$POOL-deploy.json"
[ -f "$DEPLOY" ] || { echo "run s1-deploy.sh first" >&2; exit 1; }
case "$POOL" in unichain) RPC="${UNICHAIN_SEPOLIA_RPC:?}" ;; base) RPC="${BASE_SEPOLIA_RPC:?}" ;; esac
SOURCE=$(jq -r .pingSource "$DEPLOY"); SINK=$(jq -r .pongSink "$DEPLOY"); RC=$(jq -r .pingReactive "$DEPLOY")

now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
sleep_poll() { node -e "setTimeout(()=>{}, $POLL_MS)"; }
# wait_log <rpc> <from-block> <address> <event-sig> <seq>: prints the first matching log as JSON.
# cast 1.8.3 --json prints a plain array on success. On an RPC error it exits 1 and prints an error envelope object,
# so check both the exit code and the type. Public RPCs cap eth_getLogs at 1000 blocks (Unichain Sepolia, checked
# 2026-11-06). TIMEOUT_S keeps the window under that: 90 s ≈ 90 Unichain blocks or ≈ 450 Base Sepolia blocks.
wait_log() {
  local deadline=$(( $(date +%s) + TIMEOUT_S )) out n
  while :; do
    if out=$(cast logs --rpc-url "$1" --from-block "$2" --address "$3" "$4" "$5" --json 2>/dev/null); then
      n=$(echo "$out" | jq 'if type == "array" then length else 0 end')
      [ "$n" -gt 0 ] && { echo "$out" | jq -c '.[0]'; return 0; }
    fi
    [ "$(date +%s)" -ge "$deadline" ] && return 1
    sleep_poll
  done
}
block_ts() { cast block "$2" --field timestamp --rpc-url "$1"; }

for _ in $(seq 1 "$RUNS"); do
  POOL_FROM=$(cast block-number --rpc-url "$RPC"); LASNA_FROM=$(cast block-number --rpc-url "$LASNA_RPC")
  T_SEND=$(now_ms)
  PING_RCPT=$(cast send "$SOURCE" "ping()" --rpc-url "$RPC" --account "$ACCOUNT" --json)
  T_ORIGIN=$(now_ms)
  SEQ=$(echo "$PING_RCPT" | jq -r '.logs[0].topics[1]' | cast to-dec)
  LASNA_LOG=$(wait_log "$LASNA_RPC" "$LASNA_FROM" "$RC" "PingSeen(uint256,uint256,uint256)" "$SEQ") \
    || { echo "seq $SEQ: no reactive tx on Lasna within ${TIMEOUT_S}s" >&2; continue; }
  T_LASNA=$(now_ms)
  PONG_LOG=$(wait_log "$RPC" "$POOL_FROM" "$SINK" "Pong(uint256,address,bool,uint256,uint256,uint256)" "$SEQ") \
    || { echo "seq $SEQ: no callback within ${TIMEOUT_S}s" >&2; continue; }
  T_DEST=$(now_ms)

  O_TX=$(echo "$PING_RCPT" | jq -r .transactionHash); O_BLK=$(echo "$PING_RCPT" | jq -r .blockNumber | cast to-dec)
  L_TX=$(echo "$LASNA_LOG" | jq -r .transactionHash); L_BLK=$(echo "$LASNA_LOG" | jq -r .blockNumber | cast to-dec)
  D_TX=$(echo "$PONG_LOG" | jq -r .transactionHash);  D_BLK=$(echo "$PONG_LOG" | jq -r .blockNumber | cast to-dec)
  INJECTED=$(echo "$PONG_LOG" | jq -r '.topics[2]'); MATCH=$(echo "$PONG_LOG" | jq -r '"0x" + .data[2:66]' | cast to-dec)

  jq -n --argjson seq "$SEQ" --arg pool "$POOL" \
    --arg oTx "$O_TX" --argjson oBlk "$O_BLK" --argjson oTs "$(block_ts "$RPC" "$O_BLK")" \
    --arg lTx "$L_TX" --argjson lBlk "$L_BLK" --argjson lTs "$(block_ts "$LASNA_RPC" "$L_BLK")" \
    --arg dTx "$D_TX" --argjson dBlk "$D_BLK" --argjson dTs "$(block_ts "$RPC" "$D_BLK")" \
    --argjson tSend "$T_SEND" --argjson tOrigin "$T_ORIGIN" --argjson tLasna "$T_LASNA" --argjson tDest "$T_DEST" \
    --arg injected "$INJECTED" --argjson match "$MATCH" --arg rc "$RC" \
    --argjson oR "$PING_RCPT" --argjson lR "$(cast receipt "$L_TX" --rpc-url "$LASNA_RPC" --json)" \
    --argjson dR "$(cast receipt "$D_TX" --rpc-url "$RPC" --json)" '
    { seq:$seq, pool:$pool,
      hops: { origin:{tx:$oTx, block:$oBlk, blockTs:$oTs}, lasna:{tx:$lTx, block:$lBlk, blockTs:$lTs},
              callback:{tx:$dTx, block:$dBlk, blockTs:$dTs} },
      wallClockMs: { originMinedToLasnaSeen: ($tLasna-$tOrigin), originMinedToCallbackSeen: ($tDest-$tOrigin),
                     sendToCallbackSeen: ($tDest-$tSend) },
      blockTsDeltaS: { originToLasna: ($lTs-$oTs), originToCallback: ($dTs-$oTs) },
      injectedSender:$injected, expectedReactive:$rc, injectedSenderMatches:($match==1),
      receipts: { origin:$oR, lasna:$lR, callback:$dR } }' > "../docs/evidence/s1/$POOL-loop-$SEQ.json"
  echo "seq $SEQ  origin→lasna $((T_LASNA-T_ORIGIN)) ms  origin→callback $((T_DEST-T_ORIGIN)) ms  sender-matches=$MATCH"
done

echo "--- summary ($POOL, wall clock origin mined → callback seen)"
jq -s 'map(.wallClockMs.originMinedToCallbackSeen) | sort | {runs:length, minMs:.[0], medianMs:.[(length/2|floor)], maxMs:.[-1]}' \
  ../docs/evidence/s1/"$POOL"-loop-*.json

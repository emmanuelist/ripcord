#!/usr/bin/env bash
# The Ripcord loop, for real: mint a v4 position, approve the vault, arm a line just past the current price, wait until
# Lasna is tracking it, push one real swap across it, then time the reactive tx and the exit.
#
#   RUNS=1 ./script/demo-loop.sh      (run from contracts/; needs ../docs/evidence/m1/deploy.json)
#
# Runs alternate direction (odd: stop-loss below, swap down; even: exit above, swap up), so the price oscillates
# around its start instead of drifting. Each run saves its three receipts and timings to ../docs/evidence/m1/loop-<tokenId>.json.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f ../.env ] && set -a && . ../.env && set +a
: "${DEPLOYER_ADDRESS:?}"; : "${ACCOUNT:?}"; : "${KEYSTORE_PASSWORD_FILE:?}"; : "${LASNA_RPC:?}"; : "${UNICHAIN_SEPOLIA_RPC:?}"
. script/spike/lib.sh
RUNS=${RUNS:-1}; GAP=${GAP:-120}; SWAP_IN=${SWAP_IN:-10000000000000000000}; TIMEOUT_S=${TIMEOUT_S:-90}
U=$UNICHAIN_SEPOLIA_RPC; L=$LASNA_RPC; D=../docs/evidence/m1/deploy.json
[ -f "$D" ] || { echo "run deploy-ripcord.sh first" >&2; exit 1; }
VAULT=$(jq -r .ripcordVault $D); RC=$(jq -r .ripcordReactive $D); POOL_ID=$(jq -r .poolId $D)
T0=$(jq -r .token0 $D); T1=$(jq -r .token1 $D); POSM=$(jq -r .positionManager $D); SV=$(jq -r .stateView $D); ROUTER=$(jq -r .swapRouter $D)
SIGN=(--account "$ACCOUNT" --password-file "$KEYSTORE_PASSWORD_FILE")
KEY="($T0,$T1,3000,60,0x0000000000000000000000000000000000000000)"
tick_now() { cast call "$SV" 'getSlot0(bytes32)(uint160,int24,uint24,uint24)' "$POOL_ID" --rpc-url "$U" | sed -n 2p | awk '{print $1}'; }

for run in $(seq 1 "$RUNS"); do
  # 1. a fresh position (lines are one-shot)
  TOKEN0=$T0 TOKEN1=$T1 forge script script/DeployRipcord.s.sol:MintDemoPosition --rpc-url "$U" "${SIGN[@]}" \
    --sender "$DEPLOYER_ADDRESS" --broadcast >/dev/null
  TRANSFER=$(cast keccak 'Transfer(address,address,uint256)')
  TOKEN_ID=$(jq -r --arg posm "$(echo "$POSM" | tr A-F a-f)" --arg t "$TRANSFER" \
    '[.receipts[].logs[] | select((.address|ascii_downcase)==$posm and .topics[0]==$t)][0].topics[3]' \
    broadcast/DeployRipcord.s.sol/1301/run-latest.json | cast to-dec)
  [ "$(cast call "$POSM" 'ownerOf(uint256)(address)' "$TOKEN_ID" --rpc-url "$U")" = "$DEPLOYER_ADDRESS" ] || { echo "tokenId $TOKEN_ID not ours" >&2; exit 1; }

  # 2. approve + arm a line GAP ticks past the current price, in this run's direction
  NOW=$(tick_now)
  if [ $((run % 2)) -eq 1 ]; then BELOW=true; LINE=$((NOW - GAP)); ZFO=true; LIMIT=4295128740
  else BELOW=false; LINE=$((NOW + GAP)); ZFO=false; LIMIT=1461446703485210103287273052203988822378723970341; fi
  cast send "$POSM" 'approve(address,uint256)' "$VAULT" "$TOKEN_ID" --rpc-url "$U" "${SIGN[@]}" --json >/dev/null
  L_FROM=$(cast block-number --rpc-url "$L")
  ARM_RCPT=$(cast send --rpc-url "$U" "${SIGN[@]}" --json "$VAULT" 'arm(uint256,int24,bool)' -- "$TOKEN_ID" "$LINE" "$BELOW")
  TRACK=$(wait_log "$L" "$L_FROM" "$RC" 'LineTracked(bytes32 indexed,uint256 indexed,int24,bool)' "$POOL_ID" "$TOKEN_ID") \
    || { echo "run $run: Lasna never tracked tokenId $TOKEN_ID" >&2; exit 1; }
  echo "run $run · tokenId $TOKEN_ID · tick $NOW · line $LINE (below=$BELOW) · tracked on Lasna in tx $(echo "$TRACK" | jq -r .transactionHash | cut -c1-12)…"

  # 3. one real swap across the line, then time each hop
  U_FROM=$(cast block-number --rpc-url "$U"); L_FROM=$(cast block-number --rpc-url "$L")
  T_SEND=$(now_ms)
  SWAP_RCPT=$(cast send "$ROUTER" 'swap((address,address,uint24,int24,address),(bool,int256,uint160),(bool,bool),bytes)' \
    "$KEY" "($ZFO,-$SWAP_IN,$LIMIT)" "(false,false)" 0x --rpc-url "$U" "${SIGN[@]}" --json)
  T_ORIGIN=$(now_ms)
  AFTER=$(tick_now)
  PULLED=$(wait_log "$L" "$L_FROM" "$RC" 'RipcordPulled(bytes32 indexed,uint256 indexed,int24,uint256,uint256)' "$POOL_ID" "$TOKEN_ID") \
    || { echo "run $run: no RipcordPulled on Lasna (tick after swap $AFTER, line $LINE)" >&2; exit 1; }
  T_LASNA=$(now_ms)
  EXITED_T0=$(cast keccak 'Exited(bytes32,uint256,address,int24,int24,int24,uint128,uint256,uint256,uint256,uint256)')
  FAILED_T0=$(cast keccak 'ExitFailed(bytes32,uint256,address,bytes)')
  RESULT=""; T_DEST=0; DEST=""
  deadline=$(( $(date +%s) + TIMEOUT_S ))
  while [ -z "$RESULT" ]; do
    if out=$(cast logs --rpc-url "$U" --from-block "$U_FROM" --address "$VAULT" --json 2>/dev/null); then
      DEST=$(echo "$out" | jq -c --arg e "$EXITED_T0" --arg f "$FAILED_T0" --arg id "$(cast to-uint256 "$TOKEN_ID")" \
        '[.[] | select((.topics[0]==$e or .topics[0]==$f) and .topics[2]==$id)][0] // empty')
      [ -n "$DEST" ] && { T_DEST=$(now_ms); RESULT=$([ "$(echo "$DEST" | jq -r '.topics[0]')" = "$EXITED_T0" ] && echo exited || echo exit-failed); }
    fi
    [ -z "$RESULT" ] && [ "$(date +%s)" -ge "$deadline" ] && { RESULT=no-callback; break; }
    [ -z "$RESULT" ] && sleep_poll
  done
  LIQ=$(cast call "$POSM" 'getPositionLiquidity(uint256)(uint128)' "$TOKEN_ID" --rpc-url "$U" | awk '{print $1}')
  S_TX=$(echo "$SWAP_RCPT" | jq -r .transactionHash); L_TX=$(echo "$PULLED" | jq -r .transactionHash); D_TX=$(echo "$DEST" | jq -r '.transactionHash // empty')
  S_BLK=$(echo "$SWAP_RCPT" | jq -r .blockNumber | cast to-dec); D_BLK=$([ -n "$D_TX" ] && echo "$DEST" | jq -r .blockNumber | cast to-dec || echo 0)
  jq -n --arg result "$RESULT" --arg tokenId "$TOKEN_ID" --argjson line "$LINE" --argjson below "$BELOW" \
    --argjson tickBefore "$NOW" --argjson tickAfterSwap "$AFTER" --arg liquidityAfter "$LIQ" \
    --argjson tS "$T_SEND" --argjson tO "$T_ORIGIN" --argjson tL "$T_LASNA" --argjson tD "$T_DEST" \
    --argjson sBlk "$S_BLK" --argjson dBlk "$D_BLK" \
    --argjson arm "$ARM_RCPT" --argjson swap "$SWAP_RCPT" --argjson lasna "$(cast receipt "$L_TX" --rpc-url "$L" --json)" \
    --argjson exit "$( [ -n "$D_TX" ] && cast receipt "$D_TX" --rpc-url "$U" --json || echo null)" \
    '{result:$result, tokenId:$tokenId, line:$line, exitBelow:$below, tickBefore:$tickBefore, tickAfterSwap:$tickAfterSwap,
      liquidityAfter:$liquidityAfter, unichainBlocksSwapToExit:($dBlk-$sBlk),
      wallClockMs:{swapMinedToLasnaSeen:($tL-$tO), swapMinedToExitSeen:($tD-$tO), swapSentToExitSeen:($tD-$tS)},
      receipts:{arm:$arm, swap:$swap, lasna:$lasna, exit:$exit}}' > "../docs/evidence/m1/loop-$TOKEN_ID.json"
  echo "run $run · $RESULT · tick ${NOW}→${AFTER} · liquidity after $LIQ · swap→exit $((D_BLK-S_BLK)) blocks, $((T_DEST-T_ORIGIN)) ms wall · swap $S_TX · exit $D_TX"
done

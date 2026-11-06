#!/usr/bin/env bash
# Spike S2 on-chain: a Reactive callback through the real Unichain Sepolia proxy pulls all liquidity from a real v4
# position. ExitProbe is only APPROVED on the position (custody model: the owner keeps the NFT).
#
#   ./script/spike/s2-run.sh      (run from contracts/; reads ../.env)
#
# Saves addresses, the three hop receipts and before/after state to ../docs/evidence/s2/.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f ../.env ] && set -a && . ../.env && set +a
: "${DEPLOYER_ADDRESS:?}"; : "${ACCOUNT:?}"; : "${KEYSTORE_PASSWORD_FILE:?}"; : "${LASNA_RPC:?}"; : "${UNICHAIN_SEPOLIA_RPC:?}"
. script/spike/lib.sh
U=$UNICHAIN_SEPOLIA_RPC; L=$LASNA_RPC; POSM=0xf969Aee60879C54bAAed9F3eD26147Db216Fd664
UNLOCK=(--account "$ACCOUNT" --password-file "$KEYSTORE_PASSWORD_FILE" --sender "$DEPLOYER_ADDRESS")
OUT=../docs/evidence/s2; mkdir -p "$OUT"
[ "$(cast chain-id --rpc-url "$U")" = 1301 ] && [ "$(cast chain-id --rpc-url "$L")" = 5318007 ] || { echo "wrong RPCs" >&2; exit 1; }

echo "== 1. test tokens, pool and position"
forge script script/spike/DeployS2.s.sol:SetupS2Position --rpc-url "$U" "${UNLOCK[@]}" --broadcast >/dev/null
SETUP=broadcast/DeployS2.s.sol/1301/run-latest.json; cp "$SETUP" "$OUT/setup-broadcast.json"
TRANSFER=$(cast keccak 'Transfer(address,address,uint256)')
TOKEN_ID=$(jq -r --arg posm "$(echo $POSM | tr A-F a-f)" --arg t "$TRANSFER" \
  '[.receipts[].logs[] | select((.address|ascii_downcase)==$posm and .topics[0]==$t and (.topics[1]|test("^0x0+$")))][0].topics[3]' \
  "$SETUP" | cast to-dec)
[ "$(cast call $POSM 'ownerOf(uint256)(address)' "$TOKEN_ID" --rpc-url "$U")" = "$DEPLOYER_ADDRESS" ] || { echo "tokenId $TOKEN_ID not ours" >&2; exit 1; }
echo "position tokenId $TOKEN_ID, liquidity $(cast call $POSM 'getPositionLiquidity(uint256)(uint128)' "$TOKEN_ID" --rpc-url "$U")"

echo "== 2. trigger source + ExitProbe on Unichain, ExitReactive on Lasna"
EXPECTED=$(expected_create "$DEPLOYER_ADDRESS" "$L"); L_NONCE=$(cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$L")
EXPECTED_REACTIVE=$EXPECTED forge script script/spike/DeployS2.s.sol:DeployS2Pool --rpc-url "$U" "${UNLOCK[@]}" --broadcast >/dev/null
POOLRUN=broadcast/DeployS2.s.sol/1301/run-latest.json; cp "$POOLRUN" "$OUT/pool-broadcast.json"
TRIGGER=$(jq -r '[.transactions[] | select(.contractName=="ExitTriggerSource")][0].contractAddress' "$POOLRUN")
PROBE=$(jq -r '[.transactions[] | select(.contractName=="ExitProbe")][0].contractAddress' "$POOLRUN")
[ "$(cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$L")" = "$L_NONCE" ] || { echo "Lasna nonce moved" >&2; exit 1; }
TRIGGER_SOURCE=$TRIGGER EXIT_PROBE=$PROBE EXPECTED_REACTIVE=$EXPECTED \
  forge script script/spike/DeployS2.s.sol:DeployS2Reactive --rpc-url "$L" "${UNLOCK[@]}" --broadcast ${LASNA_LEGACY:+--legacy} >/dev/null
cp broadcast/DeployS2.s.sol/5318007/run-latest.json "$OUT/lasna-broadcast.json"
echo "trigger $TRIGGER · probe $PROBE · reactive $EXPECTED"

echo "== 3. approve ExitProbe on the position (owner keeps the NFT)"
cast send $POSM 'approve(address,uint256)' "$PROBE" "$TOKEN_ID" --rpc-url "$U" "${UNLOCK[@]:0:4}" --json | jq -c '{transactionHash, status}'

LIQ_BEFORE=$(cast call $POSM 'getPositionLiquidity(uint256)(uint128)' "$TOKEN_ID" --rpc-url "$U" | awk '{print $1}')
U_FROM=$(cast block-number --rpc-url "$U"); L_FROM=$(cast block-number --rpc-url "$L")
echo "== 4. request exit (liquidity before: $LIQ_BEFORE)"
T_SEND=$(now_ms)
O_RCPT=$(cast send "$TRIGGER" 'requestExit(uint256)' "$TOKEN_ID" --rpc-url "$U" "${UNLOCK[@]:0:4}" --json); T_ORIGIN=$(now_ms)
L_LOG=$(wait_log "$L" "$L_FROM" "$EXPECTED" 'ExitRequestSeen(uint256 indexed,uint256,uint256)' "$TOKEN_ID") || { echo "no reactive tx" >&2; exit 1; }
T_LASNA=$(now_ms)
EXITED=$(cast keccak 'Exited(uint256,uint128,int24,int24)')
if D_LOG=$(wait_log "$U" "$U_FROM" "$PROBE" "$EXITED" "$(cast to-uint256 "$TOKEN_ID")"); then T_DEST=$(now_ms); RESULT=exited
else
  RESULT=no-exit-event
  D_LOG=$(cast logs --rpc-url "$U" --from-block "$U_FROM" --address 0x775c9B990ADe401060B78D0e98684eEf8d2466C1 --json | jq -c '.[-1] // {}')
  T_DEST=$(now_ms)
fi
LIQ_AFTER=$(cast call $POSM 'getPositionLiquidity(uint256)(uint128)' "$TOKEN_ID" --rpc-url "$U" | awk '{print $1}')
D_TX=$(echo "$D_LOG" | jq -r '.transactionHash // empty'); L_TX=$(echo "$L_LOG" | jq -r .transactionHash)
jq -n --arg result "$RESULT" --arg tokenId "$TOKEN_ID" --arg liqBefore "$LIQ_BEFORE" --arg liqAfter "$LIQ_AFTER" \
  --arg trigger "$TRIGGER" --arg probe "$PROBE" --arg reactive "$EXPECTED" \
  --argjson tO "$T_ORIGIN" --argjson tL "$T_LASNA" --argjson tD "$T_DEST" --argjson tS "$T_SEND" \
  --argjson oR "$O_RCPT" --argjson lR "$(cast receipt "$L_TX" --rpc-url "$L" --json)" \
  --argjson dR "$( [ -n "$D_TX" ] && cast receipt "$D_TX" --rpc-url "$U" --json || echo null)" \
  '{result:$result, tokenId:$tokenId, liquidityBefore:$liqBefore, liquidityAfter:$liqAfter,
    contracts:{exitTriggerSource:$trigger, exitProbe:$probe, exitReactive:$reactive},
    wallClockMs:{originMinedToLasnaSeen:($tL-$tO), originMinedToExitSeen:($tD-$tO), sendToExitSeen:($tD-$tS)},
    receipts:{origin:$oR, lasna:$lR, callback:$dR}}' > "$OUT/exit-$TOKEN_ID.json"
echo "result $RESULT · liquidity $LIQ_BEFORE -> $LIQ_AFTER · origin→lasna $((T_LASNA-T_ORIGIN)) ms · origin→exit $((T_DEST-T_ORIGIN)) ms"
echo "callback tx $D_TX"

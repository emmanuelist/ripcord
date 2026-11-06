#!/usr/bin/env bash
# Deploys Ripcord: the demo pool (disclosed test tokens) and RipcordVault on Unichain Sepolia, then RipcordReactive on
# Lasna at the address the vault was told to trust.
#
#   ./script/deploy-ripcord.sh      (run from contracts/; reads ../.env)
#
# Writes ../docs/evidence/m1/deploy.json and the broadcast receipts.
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f ../.env ] && set -a && . ../.env && set +a
: "${DEPLOYER_ADDRESS:?}"; : "${ACCOUNT:?}"; : "${KEYSTORE_PASSWORD_FILE:?}"; : "${LASNA_RPC:?}"; : "${UNICHAIN_SEPOLIA_RPC:?}"
. script/spike/lib.sh
U=$UNICHAIN_SEPOLIA_RPC; L=$LASNA_RPC
UNLOCK=(--account "$ACCOUNT" --password-file "$KEYSTORE_PASSWORD_FILE" --sender "$DEPLOYER_ADDRESS")
OUT=../docs/evidence/m1; mkdir -p "$OUT"
[ "$(cast chain-id --rpc-url "$U")" = 1301 ] && [ "$(cast chain-id --rpc-url "$L")" = 5318007 ] || { echo "wrong RPCs" >&2; exit 1; }

echo "== demo pool"
LOG=$(forge script script/DeployRipcord.s.sol:SetupDemoPool --rpc-url "$U" "${UNLOCK[@]}" --broadcast 2>&1)
TOKEN0=$(echo "$LOG" | awk '/token0 0x/{print $2; exit}'); TOKEN1=$(echo "$LOG" | awk '/token1 0x/{print $2; exit}')
POOL_ID=$(echo "$LOG" | grep -oE '0x[0-9a-f]{64}' | head -1)
cp broadcast/DeployRipcord.s.sol/1301/run-latest.json "$OUT/demo-pool-broadcast.json"
echo "token0 $TOKEN0 · token1 $TOKEN1 · poolId $POOL_ID"

echo "== vault (Unichain) and reactive (Lasna)"
EXPECTED=$(expected_create "$DEPLOYER_ADDRESS" "$L"); L_NONCE=$(cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$L")
EXPECTED_REACTIVE=$EXPECTED forge script script/DeployRipcord.s.sol:DeployRipcordVault --rpc-url "$U" "${UNLOCK[@]}" --broadcast >/dev/null
VAULT=$(jq -r '[.transactions[] | select(.contractName=="RipcordVault")][0].contractAddress' broadcast/DeployRipcord.s.sol/1301/run-latest.json)
cp broadcast/DeployRipcord.s.sol/1301/run-latest.json "$OUT/vault-broadcast.json"
[ "$(cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$L")" = "$L_NONCE" ] || { echo "Lasna nonce moved" >&2; exit 1; }
VAULT=$VAULT EXPECTED_REACTIVE=$EXPECTED \
  forge script script/DeployRipcord.s.sol:DeployRipcordReactive --rpc-url "$L" "${UNLOCK[@]}" --broadcast ${LASNA_LEGACY:+--legacy} >/dev/null
cp broadcast/DeployRipcord.s.sol/5318007/run-latest.json "$OUT/reactive-broadcast.json"
[ "$(cast code "$EXPECTED" --rpc-url "$L" | wc -c)" -gt 10 ] || { echo "no code at $EXPECTED on Lasna" >&2; exit 1; }

jq -n --arg t0 "$TOKEN0" --arg t1 "$TOKEN1" --arg pool "$POOL_ID" --arg vault "$VAULT" --arg rc "$EXPECTED" \
  --arg at "$(date -u +%FT%TZ)" \
  '{poolChain:"unichain-sepolia", poolChainId:1301, token0:$t0, token1:$t1, poolId:$pool, fee:3000, tickSpacing:60,
    ripcordVault:$vault, ripcordReactive:$rc, callbackProxy:"0x775c9B990ADe401060B78D0e98684eEf8d2466C1",
    poolManager:"0x00B036B58a818B1BC34d502D3fE730Db729e62AC", positionManager:"0xf969Aee60879C54bAAed9F3eD26147Db216Fd664",
    stateView:"0xc199f1072a74d4e905aba1a84d9a45e2546b6222", swapRouter:"0x9140a78c1a137C7fF1c151EC8231272aF78a99A4",
    deployedAt:$at}' > "$OUT/deploy.json"
cat "$OUT/deploy.json"

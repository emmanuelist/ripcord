#!/usr/bin/env bash
# Converts testnet ETH into lREACT on Lasna through Reactive's faucet (1 ETH -> 100 lREACT).
#
#   FROM=base AMOUNT=0.05 ./script/fund-lreact.sh      (run from contracts/; FROM=base or FROM=sepolia)
#
# The faucet pays min(value, max_payout) and KEEPS the rest. max_payout is read on-chain before sending, and the
# script refuses to send more than it (Base Sepolia 1 ETH, Ethereum Sepolia 50 ETH on 2026-11-06).
set -euo pipefail
cd "$(dirname "$0")/.."
[ -f ../.env ] && set -a && . ../.env && set +a
: "${FROM:?set FROM=base or FROM=sepolia}"; : "${AMOUNT:?set AMOUNT in ETH, e.g. 0.05}"
: "${DEPLOYER_ADDRESS:?}"; : "${ACCOUNT:?}"; : "${KEYSTORE_PASSWORD_FILE:?}"; : "${LASNA_RPC:?}"
case "$FROM" in
  base)    RPC="${BASE_SEPOLIA_RPC:?}"; CHAIN=84532;    FAUCET=0x2afaFD298b23b62760711756088F75B7409f5967 ;;
  sepolia) RPC="${SEPOLIA_RPC:?}";      CHAIN=11155111; FAUCET=0x9b9BB25f1A81078C544C829c5EB7822d747Cf434 ;;
  *) echo "FROM must be base or sepolia" >&2; exit 1 ;;
esac
[ "$(cast chain-id --rpc-url "$RPC")" = "$CHAIN" ] || { echo "RPC is not chain $CHAIN" >&2; exit 1; }
WEI=$(cast to-wei "$AMOUNT" ether)
CAP=$(cast call "$FAUCET" 'max_payout()(uint256)' --rpc-url "$RPC" | awk '{print $1}')
BAL=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC")
python3 -c "import sys; w,c,b=map(int,sys.argv[1:]); sys.exit(0 if w<=c else 3)" "$WEI" "$CAP" "$BAL" \
  || { echo "refusing: $AMOUNT ETH exceeds the faucet cap of $(cast from-wei "$CAP") ETH; the excess would be lost" >&2; exit 1; }
python3 -c "import sys; w,b=map(int,sys.argv[1:]); sys.exit(0 if w<b else 3)" "$WEI" "$BAL" \
  || { echo "refusing: balance $(cast from-wei "$BAL") ETH can't cover $AMOUNT ETH plus gas" >&2; exit 1; }
BEFORE=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$LASNA_RPC")
cast send "$FAUCET" "request(address)" "$DEPLOYER_ADDRESS" --value "$WEI" --rpc-url "$RPC" \
  --account "$ACCOUNT" --password-file "$KEYSTORE_PASSWORD_FILE" --json | jq '{transactionHash, status, blockNumber}'
echo "waiting for lREACT on Lasna (was $(cast from-wei "$BEFORE"))..."
for _ in $(seq 1 60); do
  NOW=$(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$LASNA_RPC")
  [ "$NOW" != "$BEFORE" ] && { echo "lREACT balance: $(cast from-wei "$NOW")"; exit 0; }
  sleep 2
done
echo "no lREACT after 120 s: check the faucet tx on the explorer" >&2; exit 1

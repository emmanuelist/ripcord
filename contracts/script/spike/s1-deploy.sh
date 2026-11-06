#!/usr/bin/env bash
# Spike S1 deploy: PingSource + PongSink on the pool chain, then PingReactive on Lasna.
#
#   POOL=unichain ACCOUNT=ripcord-deployer ./script/spike/s1-deploy.sh      (run from contracts/)
#
# Needs: LASNA_RPC, UNICHAIN_SEPOLIA_RPC or BASE_SEPOLIA_RPC, DEPLOYER_ADDRESS (from ../.env), and a Foundry
# keystore account (`cast wallet import <name> --interactive`). No private key is ever read from a file.
# Writes the deployed addresses to ../docs/evidence/s1/<pool>-deploy.json.
set -euo pipefail
cd "$(dirname "$0")/../.."
[ -f ../.env ] && set -a && . ../.env && set +a

: "${POOL:?set POOL=unichain or POOL=base}"
: "${ACCOUNT:?set ACCOUNT to your Foundry keystore account name}"
: "${DEPLOYER_ADDRESS:?set DEPLOYER_ADDRESS in .env}"
: "${LASNA_RPC:?set LASNA_RPC in .env}"

case "$POOL" in
  unichain) RPC="${UNICHAIN_SEPOLIA_RPC:?}"; CHAIN=1301;  PROXY=0x775c9B990ADe401060B78D0e98684eEf8d2466C1 ;;
  base)     RPC="${BASE_SEPOLIA_RPC:?}";     CHAIN=84532; PROXY=0x476F44b11F5C942c58f4c8E3d0300E5710743585 ;;
  *) echo "POOL must be unichain or base" >&2; exit 1 ;;
esac

[ "$(cast chain-id --rpc-url "$LASNA_RPC")" = 5318007 ] || { echo "LASNA_RPC is not Lasna" >&2; exit 1; }
[ "$(cast chain-id --rpc-url "$RPC")" = "$CHAIN" ] || { echo "pool RPC is not chain $CHAIN" >&2; exit 1; }
echo "balances: pool $(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$RPC" --ether) ETH · lasna $(cast balance "$DEPLOYER_ADDRESS" --rpc-url "$LASNA_RPC" --ether) lREACT"

NONCE=$(cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$LASNA_RPC")
EXPECTED=$(cast compute-address "$DEPLOYER_ADDRESS" --nonce "$NONCE" | awk '{print $NF}')
echo "PingReactive will be deployed at $EXPECTED (deployer Lasna nonce $NONCE)"

POOL_CHAIN_ID=$CHAIN CALLBACK_PROXY=$PROXY EXPECTED_REACTIVE=$EXPECTED \
  forge script script/spike/DeployS1.s.sol:DeployS1Pool --rpc-url "$RPC" \
  --account "$ACCOUNT" --sender "$DEPLOYER_ADDRESS" --broadcast

RUN="broadcast/DeployS1.s.sol/$CHAIN/run-latest.json"
SOURCE=$(jq -r '[.transactions[] | select(.contractName=="PingSource")][0].contractAddress' "$RUN")
SINK=$(jq -r '[.transactions[] | select(.contractName=="PongSink")][0].contractAddress' "$RUN")

[ "$(cast nonce "$DEPLOYER_ADDRESS" --rpc-url "$LASNA_RPC")" = "$NONCE" ] || { echo "Lasna nonce moved; redeploy" >&2; exit 1; }
POOL_CHAIN_ID=$CHAIN PING_SOURCE=$SOURCE PONG_SINK=$SINK EXPECTED_REACTIVE=$EXPECTED \
  forge script script/spike/DeployS1.s.sol:DeployS1Reactive --rpc-url "$LASNA_RPC" \
  --account "$ACCOUNT" --sender "$DEPLOYER_ADDRESS" --broadcast ${LASNA_LEGACY:+--legacy}

mkdir -p ../docs/evidence/s1
jq -n --arg pool "$POOL" --argjson chain "$CHAIN" --arg source "$SOURCE" --arg sink "$SINK" \
  --arg reactive "$EXPECTED" --arg proxy "$PROXY" --arg at "$(date -u +%FT%TZ)" \
  '{pool:$pool, poolChainId:$chain, pingSource:$source, pongSink:$sink, pingReactive:$reactive, callbackProxy:$proxy, deployedAt:$at}' \
  > "../docs/evidence/s1/$POOL-deploy.json"
cp "$RUN" "../docs/evidence/s1/$POOL-pool-broadcast.json"
cp "broadcast/DeployS1.s.sol/5318007/run-latest.json" "../docs/evidence/s1/$POOL-lasna-broadcast.json"
cat "../docs/evidence/s1/$POOL-deploy.json"

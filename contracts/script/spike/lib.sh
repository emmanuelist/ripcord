#!/usr/bin/env bash
# Shared helpers for the spike scripts. Source it; don't run it.
# Traps behind these (docs/CONTEXT.md): cast 1.8.3 `logs --json` prints an error envelope on stdout when it fails;
# public RPCs cap eth_getLogs at 1000 blocks; macOS `seq` prints large numbers in scientific notation.

now_ms() { node -e 'process.stdout.write(String(Date.now()))'; }
sleep_poll() { node -e "setTimeout(()=>{}, ${POLL_MS:-100})"; }

# wait_log <rpc> <from-block> <address> <event-sig-or-topic0> [topic1]: prints the first matching log as JSON.
wait_log() {
  local deadline=$(( $(date +%s) + ${TIMEOUT_S:-90} )) out n
  while :; do
    if out=$(cast logs --rpc-url "$1" --from-block "$2" --address "$3" "$4" ${5:+"$5"} --json 2>/dev/null); then
      n=$(echo "$out" | jq 'if type == "array" then length else 0 end')
      [ "$n" -gt 0 ] && { echo "$out" | jq -c '.[0]'; return 0; }
    fi
    [ "$(date +%s)" -ge "$deadline" ] && return 1
    sleep_poll
  done
}

# expected_create <deployer> <rpc>: the address of the deployer's next CREATE on that chain
expected_create() { cast compute-address "$1" --nonce "$(cast nonce "$1" --rpc-url "$2")" | awk '{print $NF}'; }

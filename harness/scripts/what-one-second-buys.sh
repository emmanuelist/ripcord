#!/usr/bin/env bash
# C-2 "what one second buys": during the worst half hour of the 10 Oct 2025 crash, how much further ETH fell
# within 7 s (one legacy Reactive block) than within 3 s (Ripcord's slowest measured loop).
# Downloads Binance's public 1-second candles, checks Binance's SHA-256, and recomputes. Needs curl, unzip, node.
set -euo pipefail
DAY=2025-10-10
FROM=2025-10-10T21:00:00Z
TO=2025-10-10T21:30:00Z
F="ETHUSDT-1s-$DAY.zip"
URL="https://data.binance.vision/data/spot/daily/klines/ETHUSDT/1s/$F"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
curl -sSf -o "$WORK/$F" "$URL"
curl -sSf -o "$WORK/$F.CHECKSUM" "$URL.CHECKSUM"
want="$(cut -d' ' -f1 "$WORK/$F.CHECKSUM")"
got="$(shasum -a 256 "$WORK/$F" | cut -d' ' -f1)"
[ "$want" = "$got" ] || { echo "checksum mismatch: $got != $want" >&2; exit 1; }
unzip -q -o "$WORK/$F" -d "$WORK"
node "$(dirname "$0")/crash-moves.mjs" "$WORK/ETHUSDT-1s-$DAY.csv" "$FROM" "$TO"

#!/bin/bash
# /api/uploads POST 테스트. vendor_id, effective_date, file 전송.
# usage: bash scripts/test-upload-e2e.sh <vendor_id> <image> [effective_date]
set -e
VID="${1:?vendor_id required}"
IMG="${2:?image path required}"
DATE="${3:-$(date +%Y-%m-%d)}"

: "${INTERNAL_PASSWORD:?env required — source .env.local}"

PORT="${PORT:-3000}"
curl -sS -X POST "http://localhost:$PORT/api/uploads" \
  -b "dbp_price_gate=$INTERNAL_PASSWORD" \
  -F "vendor_id=$VID" \
  -F "effective_date=$DATE" \
  -F "file=@$IMG;type=image/png" \
  | python3 -m json.tool

#!/usr/bin/env bash
set -euo pipefail

PORT=4182
OUT="${RUNNER_TEMP:-/tmp}"
URL="http://127.0.0.1:$PORT"
LOG="$OUT/sopflow-unified-consumer.log"
PROFILE="$OUT/sopflow-unified-consumer-chrome"
DOM="$OUT/sopflow-unified-consumer.html"
PNG="$OUT/sopflow-unified-desktop.png"
PDF="$OUT/sopflow-unified-desktop.pdf"

pnpm --filter playground dev --host 127.0.0.1 --port "$PORT" >"$LOG" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "$SERVER_PID" >/dev/null 2>&1 || true
  rm -rf "$PROFILE" "$PROFILE-valid" "$PROFILE-desktop" "$PROFILE-mobile" "$PROFILE-print" >/dev/null 2>&1 || true
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 60); do
  if curl --silent --fail "$URL/" >/dev/null; then READY=1; break; fi
  sleep 0.25
done
if [[ "$READY" != "1" ]]; then
  echo "::error::Published consumer playground failed to start"
  cat "$LOG"
  exit 1
fi

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "$CHROME" ]]; then
  echo "::error::Chrome/Chromium is required for consumer E2E"
  exit 1
fi

for variant in desktop mobile; do
  if [[ "$variant" == "desktop" ]]; then WIDTH=1365; else WIDTH=520; fi
  "$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
    --window-size="$WIDTH,900" --user-data-dir="$PROFILE-$variant" \
    --virtual-time-budget=16000 --dump-dom "$URL/?unified-regression=1" >"$DOM"
  if ! grep -q 'data-unified-consumer-regression="pass"' "$DOM"; then
    echo "::error::Unified npm consumer regression failed on $variant"
    grep -o 'id="unified-consumer-regression-status"[^>]*>[^<]*' "$DOM" || true
    cat "$LOG"
    exit 1
  fi
done

"$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --window-size=1365,900 --user-data-dir="$PROFILE-valid" \
  --virtual-time-budget=10000 --dump-dom "$URL/" >"$DOM"
if ! grep -q 'data-sopflow-ready="true"' "$DOM"; then
  echo "::error::Default published consumer fixture must be publication-ready"
  cat "$LOG"
  exit 1
fi

"$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --window-size=1365,900 --user-data-dir="$PROFILE-desktop" \
  --virtual-time-budget=6000 --screenshot="$PNG" "$URL/" >/dev/null 2>&1
test -s "$PNG"

"$CHROME" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="$PROFILE-print" --virtual-time-budget=6000 \
  --print-to-pdf="$PDF" "$URL/" >/dev/null 2>&1
test -s "$PDF"

if ! command -v pdfinfo >/dev/null; then
  sudo apt-get update -qq
  sudo apt-get install -y -qq poppler-utils
fi

python3 - "$PDF" <<'PY'
import re
import subprocess
import sys

info = subprocess.run(
    ["pdfinfo", sys.argv[1]],
    check=True,
    capture_output=True,
    text=True,
).stdout
match = re.search(r"Page size:\s*([\d.]+)\s+x\s+([\d.]+)\s+pts", info)
if not match:
    raise SystemExit("Cannot read page size from pdfinfo")
width, height = map(float, match.groups())
if abs(width - 841.89) > 5 or abs(height - 595.28) > 5:
    raise SystemExit(f"Expected A4 landscape (841.89 × 595.28pt), got {width} × {height}pt")
print(f"A4 landscape verified: {width} × {height}pt")
PY
echo "Unified npm consumer desktop/mobile/print smoke passed"

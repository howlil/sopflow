#!/usr/bin/env bash
set -euo pipefail

PORT=4175
URL="http://127.0.0.1:${PORT}/opc-source-regression.html"
LOG_FILE="${RUNNER_TEMP:-/tmp}/sopflow-source-opc-vite.log"
DOM_FILE="${RUNNER_TEMP:-/tmp}/sopflow-source-opc.html"
PNG_FILE="${RUNNER_TEMP:-/tmp}/sopflow-source-opc.png"
PDF_FILE="${RUNNER_TEMP:-/tmp}/sopflow-source-opc.pdf"
PROFILE_DIR="${RUNNER_TEMP:-/tmp}/sopflow-source-opc-chrome"

pnpm --filter playground exec vite --config vite.source-opc.config.ts --host 127.0.0.1 --port "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
  rm -rf "${PROFILE_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

for _ in $(seq 1 60); do
  if curl --silent --fail "${URL}" >/dev/null; then break; fi
  sleep 0.25
done
curl --silent --fail "${URL}" >/dev/null || {
  echo "::error::Source OPC test page did not start"
  cat "${LOG_FILE}"
  exit 1
}

CHROME_BIN="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
if [[ -z "${CHROME_BIN}" ]]; then
  echo "::error::Chrome/Chromium is required for source geometry acceptance"
  exit 1
fi
"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="${PROFILE_DIR}" --virtual-time-budget=8000 --dump-dom \
  "${URL}" >"${DOM_FILE}"

if ! grep -q 'data-source-opc-regression="pass"' "${DOM_FILE}"; then
  echo "::error::Source OPC actor alignment, SVG routing or physical page height failed"
  grep -o 'data-source-opc-regression[^>]*>[^<]*' "${DOM_FILE}" || true
  cat "${LOG_FILE}"
  exit 1
fi

"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --window-size=1365,900 --user-data-dir="${PROFILE_DIR}" \
  --virtual-time-budget=8000 --screenshot="${PNG_FILE}" "${URL}" >/dev/null 2>&1
test -s "${PNG_FILE}"

"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="${PROFILE_DIR}" --virtual-time-budget=8000 \
  --print-to-pdf="${PDF_FILE}" "${URL}" >/dev/null 2>&1
test -s "${PDF_FILE}"

grep -o 'data-source-opc-regression[^>]*>[^<]*' "${DOM_FILE}"
echo "Source OPC browser alignment and A4 PDF smoke checks passed."

# Run the same Vite source server against the actual CSS Modules and browser
# cascade. Normal playground continues to resolve packages from npm.
RADIUS_URL="http://127.0.0.1:${PORT}/radius-source-regression.html"
RADIUS_DOM="${RUNNER_TEMP:-/tmp}/sopflow-react-radius.html"
curl --silent --fail "${RADIUS_URL}" >/dev/null
"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="${PROFILE_DIR}" --virtual-time-budget=4000 --dump-dom \
  "${RADIUS_URL}" >"${RADIUS_DOM}"
if ! grep -q 'data-react-radius-regression="pass"' "${RADIUS_DOM}"; then
  echo "::error::React UI computed-radius contract failed"
  grep -o 'data-react-radius-regression[^>]*>[^<]*' "${RADIUS_DOM}" || true
  cat "${LOG_FILE}"
  exit 1
fi
grep -o 'data-react-radius-regression[^>]*>[^<]*' "${RADIUS_DOM}"
echo "React control, portal, notice, and document geometry checks passed."

# ActorField uses a custom MultiSelect. Verify its last-row listbox can escape
# the horizontal-scroll container, flip upward, follow scrolling and retain
# multiple selections without closing unexpectedly.
ACTOR_URL="http://127.0.0.1:${PORT}/actor-popover-source-regression.html"
ACTOR_DOM="${RUNNER_TEMP:-/tmp}/sopflow-actor-popover.html"
curl --silent --fail "${ACTOR_URL}" >/dev/null
"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --window-size=800,600 --user-data-dir="${PROFILE_DIR}" \
  --virtual-time-budget=8000 --dump-dom "${ACTOR_URL}" >"${ACTOR_DOM}"
if ! grep -q 'data-actor-popover-regression="pass"' "${ACTOR_DOM}"; then
  echo "::error::Actor dropdown clipped or lost input/scroll behavior"
  grep -o 'data-actor-popover-regression[^>]*>[^<]*' "${ACTOR_DOM}" || true
  cat "${LOG_FILE}"
  exit 1
fi
grep -o 'data-actor-popover-regression[^>]*>[^<]*' "${ACTOR_DOM}"
echo "Portaled ActorField popup regression passed."

# Use the same source-only Vite config for the compact BPMN pool. The normal
# playground still imports released npm packages, never workspace symlinks.
BPMN_URL="http://127.0.0.1:${PORT}/bpmn-source-regression.html"
BPMN_DOM="${RUNNER_TEMP:-/tmp}/sopflow-source-bpmn.html"
BPMN_PNG="${RUNNER_TEMP:-/tmp}/sopflow-source-bpmn.png"
BPMN_PDF="${RUNNER_TEMP:-/tmp}/sopflow-source-bpmn.pdf"
curl --silent --fail "${BPMN_URL}" >/dev/null
"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --window-size=1280,900 --user-data-dir="${PROFILE_DIR}" \
  --virtual-time-budget=7000 --dump-dom "${BPMN_URL}" >"${BPMN_DOM}"
if ! grep -q 'data-bpmn-source-regression="pass"' "${BPMN_DOM}"; then
  echo "::error::Source compact BPMN geometry, label centering or responsiveness failed"
  grep -o 'data-bpmn-source-regression[^>]*>[^<]*' "${BPMN_DOM}" || true
  cat "${LOG_FILE}"
  exit 1
fi
"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --window-size=1280,900 --user-data-dir="${PROFILE_DIR}" \
  --virtual-time-budget=7000 --screenshot="${BPMN_PNG}" "${BPMN_URL}" >/dev/null 2>&1
test -s "${BPMN_PNG}"
"${CHROME_BIN}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="${PROFILE_DIR}" --virtual-time-budget=7000 \
  --print-to-pdf="${BPMN_PDF}" "${BPMN_URL}" >/dev/null 2>&1
test -s "${BPMN_PDF}"
grep -o 'data-bpmn-source-regression[^>]*>[^<]*' "${BPMN_DOM}"
echo "Source compact BPMN geometry and A4 print smoke checks passed."

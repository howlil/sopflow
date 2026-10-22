#!/usr/bin/env bash
set -euo pipefail

PORT=18788
BASE="http://127.0.0.1:${PORT}"
OUT="${RUNNER_TEMP:-/tmp}"
LOG="${OUT}/sopflow-pages-preview.log"
PROFILE="${OUT}/sopflow-pages-chrome"
DOM="${OUT}/sopflow-pages-dom.html"

npx --yes wrangler@4 pages dev apps/landing/dist --ip 127.0.0.1 --port "${PORT}" >"${LOG}" 2>&1 &
SERVER_PID=$!
cleanup() {
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
  rm -rf "${PROFILE}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 90); do
  if curl --silent --fail "${BASE}/" >/dev/null; then READY=1; break; fi
  sleep 1
done
if [[ "${READY}" != "1" ]]; then
  echo "::error::Pages preview did not start"
  cat "${LOG}"
  exit 1
fi

check_code() {
  local path="$1" expected="$2" actual
  actual="$(curl --silent --output /dev/null --write-out '%{http_code}' "${BASE}${path}")"
  if [[ "${actual}" != "${expected}" ]]; then
    echo "::error::${path}: expected HTTP ${expected}, received ${actual}"
    exit 1
  fi
}
check_code "/" 200
check_code "/playground/" 200
check_code "/playground/?scenario=issues" 200
check_code "/totally-missing-route" 404
check_code "/playground/not-a-page" 404
check_code "/playground/assets/missing.js" 404

REDIRECT="$(curl --silent --output /dev/null --write-out '%{http_code} %{redirect_url}' "${BASE}/playground")"
[[ "${REDIRECT}" == "301 ${BASE}/playground/" ]] || {
  echo "::error::Expected /playground to redirect to /playground/, got ${REDIRECT}"
  exit 1
}

CHROME="$(command -v google-chrome || command -v google-chrome-stable || command -v chromium || command -v chromium-browser || true)"
[[ -n "${CHROME}" ]] || { echo "::error::Chrome/Chromium is required"; exit 1; }
"${CHROME}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="${PROFILE}" --virtual-time-budget=12000 \
  --dump-dom "${BASE}/playground/" >"${DOM}"
grep -q 'data-sopflow-ready="true"' "${DOM}" || {
  echo "::error::Production subpath failed to mount ready SOP"
  cat "${LOG}"
  exit 1
}

"${CHROME}" --headless --no-sandbox --disable-gpu --disable-dev-shm-usage \
  --user-data-dir="${PROFILE}-regression" --virtual-time-budget=16000 \
  --dump-dom "${BASE}/playground/?unified-regression=1" >"${DOM}"
grep -q 'data-unified-consumer-regression="pass"' "${DOM}" || {
  echo "::error::Production subpath unified regression failed"
  grep -o 'id="unified-consumer-regression-status"[^>]*>[^<]*' "${DOM}" || true
  if ! grep -q 'id="unified-consumer-regression-status"' "${DOM}"; then
    echo "::error::Regression output was not mounted in the DOM"
    head -c 3000 "${DOM}" || true
  fi
  cat "${LOG}"
  exit 1
}

echo "Cloudflare Pages composite routing and published consumer browser smoke passed"

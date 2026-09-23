#!/usr/bin/env bash
set -euo pipefail

PORT=4173
LOG_FILE="${RUNNER_TEMP:-/tmp}/sopflow-playground.log"
DOM_FILE="${RUNNER_TEMP:-/tmp}/sopflow-diagram-regression.html"
PROFILE_DIR="${RUNNER_TEMP:-/tmp}/sopflow-chrome-profile"

pnpm --filter playground dev --host 127.0.0.1 --port "${PORT}" >"${LOG_FILE}" 2>&1 &
SERVER_PID=$!

cleanup() {
  kill "${SERVER_PID}" >/dev/null 2>&1 || true
  rm -rf "${PROFILE_DIR}" >/dev/null 2>&1 || true
}
trap cleanup EXIT

READY=0
for _ in $(seq 1 40); do
  if curl --fail --silent "http://127.0.0.1:${PORT}/" >/dev/null; then
    READY=1
    break
  fi
  sleep 0.25
done

if [[ "${READY}" != "1" ]]; then
  echo "::error::Playground did not become ready"
  cat "${LOG_FILE}"
  exit 1
fi

CHROME_BIN="$(
  command -v google-chrome ||
    command -v google-chrome-stable ||
    command -v chromium ||
    command -v chromium-browser ||
    true
)"

if [[ -z "${CHROME_BIN}" ]]; then
  echo "::error::A Chrome/Chromium executable is required for diagram browser regression"
  exit 1
fi

"${CHROME_BIN}"   --headless   --no-sandbox   --disable-gpu   --disable-dev-shm-usage   --user-data-dir="${PROFILE_DIR}"   --virtual-time-budget=5000   --dump-dom   "http://127.0.0.1:${PORT}/?diagram-regression=1"   >"${DOM_FILE}"

if ! grep -q 'data-diagram-regression="pass"' "${DOM_FILE}"; then
  echo "::error::Diagram browser regression failed"
  grep -o 'data-diagram-regression-output[^>]*>[^<]*' "${DOM_FILE}" || true
  cat "${LOG_FILE}"
  exit 1
fi

echo "Diagram browser regression passed with ${CHROME_BIN}"

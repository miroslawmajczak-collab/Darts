#!/bin/sh
# Run inside the logged-in kiosk user's graphical session.
set -eu
url=http://127.0.0.1:17840
until curl --silent --fail "$url/api/health" >/dev/null; do sleep 0.2; done
if command -v chromium >/dev/null 2>&1; then browser=chromium
elif command -v chromium-browser >/dev/null 2>&1; then browser=chromium-browser
else echo 'Install Chromium first.'; exit 1; fi
exec "$browser" --kiosk --no-first-run --no-default-browser-check "$url"

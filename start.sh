#!/bin/sh
set -eu
cd "$(dirname "$0")"
command -v node >/dev/null 2>&1 || { echo 'Install Node.js 20 or newer first.'; exit 1; }
exec node server.mjs

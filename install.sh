#!/usr/bin/env bash
set -euo pipefail

# PhrasePatch — Unified installer shim for OpenCode, Codex, and AGY.
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js (>=18) is required to run the PhrasePatch installer." >&2
  exit 1
fi

node "$DIR/scripts/install.js" "$@"

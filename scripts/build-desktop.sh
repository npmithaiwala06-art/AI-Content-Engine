#!/bin/zsh
set -euo pipefail

task_root="$(cd "$(dirname "$0")/.." && pwd)"
signing_key="$task_root/.tauri/socialflow-updater.key"

if [[ ! -f "$signing_key" ]]; then
  echo "Missing updater signing key: $signing_key" >&2
  echo "See docs/AUTO_UPDATES.md before building a release." >&2
  exit 1
fi

export TAURI_SIGNING_PRIVATE_KEY="$signing_key"
export TAURI_SIGNING_PRIVATE_KEY_PASSWORD=""
npm run tauri build

#!/usr/bin/env bash
# Run from anywhere:  /path/to/next-app/dev.sh
# Or:  cd /path/to/next-app && ./dev.sh
set -euo pipefail
ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT"
echo "==> cwd: $ROOT"
echo "==> clearing .next"
rm -rf .next
echo "==> starting Next.js dev server"
exec npm run dev

#!/bin/bash
set -e
cd "$(dirname "$0")/.."
pnpm install --prefer-offline 2>/dev/null || pnpm install
echo "post-merge setup complete"

#!/bin/bash
set -e
echo "Running post-merge setup..."
cd AA-MD-Bot && npm install --prefer-offline
echo "Post-merge setup complete."

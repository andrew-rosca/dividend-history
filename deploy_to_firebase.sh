#!/bin/bash

# Script to deploy the dividend dashboard to Firebase Hosting

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo ""
echo "🚀 Deploying to Firebase Hosting..."

firebase deploy --only hosting --non-interactive

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to deploy"
    exit 1
fi

# Get project ID from .firebaserc
PROJECT_ID=$(grep -o '"default": "[^"]*"' .firebaserc | cut -d'"' -f4)

echo "✅ Deployment successful!"
echo ""
echo "Your site is live at:"
echo "  📍 https://${PROJECT_ID}.web.app"
echo ""

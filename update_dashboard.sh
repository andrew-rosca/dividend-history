#!/bin/bash

# Script to update dividend data, rebuild dashboard, and deploy to Firebase
# This script should be run regularly (e.g., daily via cron) to keep the dashboard current
#
# Prerequisites:
# - Python 3 with required packages (see requirements.txt)
# - config.yaml file with API credentials configured
# - Firebase CLI installed and authenticated
#
# Usage:
#   ./update_dashboard.sh
#
# For automated updates, add to crontab:
#   # Update and deploy dashboard daily at 6 AM
#   0 6 * * * /path/to/dividend-history/update_dashboard.sh >> /path/to/logs/update.log 2>&1

set -e  # Exit on any error

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

echo "=========================================="
echo "Dividend Dashboard Update"
echo "Started at: $(date)"
echo "=========================================="

# Activate virtual environment if it exists
if [ -d "venv" ]; then
    echo "🔧 Activating virtual environment..."
    source venv/bin/activate
elif [ -d ".venv" ]; then
    echo "🔧 Activating virtual environment..."
    source .venv/bin/activate
fi

# Step 1: Fetch latest dividend and price data
echo ""
echo "📊 Fetching latest dividend and price data..."
python3 fetch_data.py

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to fetch data"
    exit 1
fi

echo "✅ Data fetch completed"

# Step 2: Rebuild the web dashboard
echo ""
echo "🔨 Building web dashboard..."
python3 build_web_dashboard.py

if [ $? -ne 0 ]; then
    echo "❌ Error: Failed to build dashboard"
    exit 1
fi

echo "✅ Dashboard build completed"

# Step 3: Deploy to Firebase Hosting
if [ -f "deploy_to_firebase.sh" ]; then
    ./deploy_to_firebase.sh
else
    echo ""
    echo "⚠️  Warning: deploy_to_firebase.sh not found, skipping deployment"
fi

# Step 4: Summary
echo ""
echo "=========================================="
echo "✅ Update completed successfully!"
echo "Finished at: $(date)"
echo "=========================================="
echo ""
echo "📦 Dashboard assets are in: build/web_dashboard/"
echo ""

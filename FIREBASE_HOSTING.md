# Firebase Hosting Setup Guide

This guide explains how the dividend dashboard is deployed to Firebase Hosting.

## What is Firebase Hosting?

Firebase Hosting is a static web hosting service on Google Cloud Platform that provides:
- **Automatic HTTPS**: SSL certificates are managed automatically
- **Global CDN**: Fast content delivery worldwide
- **Automatic index.html**: Serves index.html by default
- **Free Tier**: Generous limits (10GB storage, 360MB/day transfer)
- **Easy Deployment**: Simple CLI-based deployment

## Current Setup

Your dashboard is deployed to:
- **URL**: https://dividend-yield-lens.web.app
- **Project ID**: dividend-yield-lens
- **Console**: https://console.firebase.google.com/project/dividend-yield-lens/overview

## How Deployment Works

The `update_dashboard.sh` script automatically:
1. Fetches latest dividend and price data
2. Rebuilds the dashboard
3. Deploys to Firebase Hosting

You can also deploy manually:
```bash
firebase deploy --only hosting
```

## Configuration Files

- **firebase.json**: Firebase Hosting configuration
  - Sets `build/web_dashboard` as the public directory
  - Configures cache headers for assets

- **.firebaserc**: Project aliases (tracked in git)
  - Links the local directory to the Firebase project

- **.firebase/**: Local Firebase cache (not tracked in git)

## Prerequisites

The Firebase CLI is already installed and authenticated. If you need to set it up on a new machine:

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Authenticate with Google
firebase login

# The project is already configured via .firebaserc
```

## Manual Deployment

To deploy without running the full update:
```bash
./deploy_to_firebase.sh
```

Or use Firebase CLI directly:
```bash
firebase deploy --only hosting
```

## Automated Updates

For scheduled updates (e.g., daily at 6 AM), add to crontab:
```bash
crontab -e
```

Then add:
```
0 6 * * * cd /Users/arosca/prj/dividend-history && ./update_dashboard.sh >> logs/update.log 2>&1
```

## Viewing Deployment History

View past deployments in the Firebase Console:
https://console.firebase.google.com/project/dividend-yield-lens/hosting

You can rollback to previous versions if needed.

## Custom Domain (Optional)

To use a custom domain:
1. Go to Firebase Console > Hosting
2. Click "Add custom domain"
3. Follow the instructions to verify ownership
4. Add the DNS records provided by Firebase

Firebase will automatically provision and manage SSL certificates for your custom domain.

## Pricing

Firebase Hosting free tier includes:
- 10 GB storage
- 360 MB/day transfer (≈ 10 GB/month)
- Free SSL certificate
- Global CDN

Your dashboard is well within these limits, so hosting is completely free.

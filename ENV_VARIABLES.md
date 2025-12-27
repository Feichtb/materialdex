# Environment Variables Reference

This document describes all environment variables used by the application.

## Required Variables

### `OPENAI_API_KEY`
- **Description**: Your OpenAI API key for GPT model access
- **Required**: Yes (for GPT models)
- **Get it**: https://platform.openai.com/api-keys
- **Usage**: Used in `/api/scan` and `/api/scan-material` when using GPT models

### `PERPLEXITY_API_KEY`
- **Description**: Your Perplexity API key for real-time web search
- **Required**: Yes (for sonar models and documentation search)
- **Get it**: https://www.perplexity.ai/settings/api
- **Usage**: Used for product search and documentation discovery

## Optional Variables

### `NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL`
- **Description**: Base URL for Firebase Cloud Functions (for longer-running scans)
- **Required**: Yes for production (Firebase handles long scans without timeouts)
- **Format**: `https://us-central1-YOUR_PROJECT_ID.cloudfunctions.net`
- **Example**: `https://us-central1-materialdex-677c3.cloudfunctions.net`
- **Usage**: Frontend uses this to call Firebase functions instead of Netlify functions
- **Note**: If not set, falls back to local `/api/scan-material` endpoint

### `API_SECRET_KEY`
- **Description**: Secret key to protect expensive API endpoints from unauthorized use
- **Required**: No (but recommended for production)
- **Generate**: 
  - Windows PowerShell: `[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))`
  - Mac/Linux: `openssl rand -hex 32`
- **Usage**: When set, expensive endpoints require `x-api-secret` header matching this value
- **Note**: If you want public access, leave this unset

## Setting Up Locally

1. Copy the example below to `.env.local`:
```env
OPENAI_API_KEY=your_openai_api_key_here
PERPLEXITY_API_KEY=your_perplexity_api_key_here
API_SECRET_KEY=your_secure_random_string_here
```

2. Replace the placeholder values with your actual keys
3. **Never commit `.env.local`** - it's already in `.gitignore`

## Setting Up on Netlify

1. Go to your Netlify site dashboard
2. Navigate to **Site settings** → **Environment variables**
3. Add each variable with its value
4. Click "Save"
5. Redeploy your site for changes to take effect

## Security Notes

- ✅ Environment variables are server-side only (never exposed to the browser)
- ✅ `.env.local` is in `.gitignore` and won't be committed
- ✅ Netlify environment variables are encrypted at rest
- ⚠️ Never log or expose API keys in error messages
- ⚠️ Set spending limits in your OpenAI/Perplexity accounts
- ⚠️ Monitor API usage regularly


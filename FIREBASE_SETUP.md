# Firebase Cloud Functions Setup

The app uses Firebase Cloud Functions for long-running AI scan operations. This avoids Netlify's 30-second function timeout.

## Prerequisites

1. Node.js 20+
2. Firebase CLI: `npm install -g firebase-tools`
3. A Firebase project (already created: `materialdex-677c3`)

## Initial Setup (One-time)

### 1. Login to Firebase

```bash
firebase login
```

### 2. Install Function Dependencies

```bash
cd functions
npm install
```

### 3. Set Environment Variables in Firebase Console

**Option A: Using Firebase Console (Recommended - No CLI issues)**

1. Go to https://console.firebase.google.com/
2. Select your project: **materialdex-677c3**
3. Go to **Functions** → **Configuration** → **Environment variables**
4. Click **Add variable** and add:
   - `PERPLEXITY_API_KEY` = your Perplexity API key
   - `OPENAI_API_KEY` = your OpenAI API key (optional)
5. Click **Save**

**Option B: Using Firebase CLI Secrets (Alternative)**

If you prefer CLI:

```bash
# Set Perplexity API key (will prompt for value)
firebase functions:secrets:set PERPLEXITY_API_KEY

# Set OpenAI API key (optional)
firebase functions:secrets:set OPENAI_API_KEY
```

**Note**: After setting variables, you must redeploy functions for changes to take effect.

### 4. Deploy Functions

```bash
# From project root
firebase deploy --only functions
```

After deployment, you'll see the function URLs:
```
Function URL (scanMaterial): https://us-central1-materialdex-677c3.cloudfunctions.net/scanMaterial
Function URL (health): https://us-central1-materialdex-677c3.cloudfunctions.net/health
```

### 5. Update Netlify Environment Variable

In Netlify dashboard:
1. Go to **Site settings** → **Environment variables**
2. Add: `NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL` = `https://us-central1-materialdex-677c3.cloudfunctions.net`
3. Redeploy the site

## Local Development

### Test Functions Locally

```bash
cd functions
npm run serve
```

This starts the Firebase emulator at `http://localhost:5001`.

### Use Local Functions in Development

Create `.env.local` in the project root:
```env
NEXT_PUBLIC_FIREBASE_FUNCTIONS_URL=http://localhost:5001/materialdex-677c3/us-central1
```

Or leave it unset to use the local Next.js API (for quick testing).

## Function Details

### `scanMaterial`
- **Timeout**: 9 minutes (540 seconds) - vs Netlify's 30 seconds
- **Memory**: 512MB
- **Purpose**: AI-powered material scanning with documentation search
- **Streaming**: Uses Server-Sent Events for real-time progress updates

### `health`
- Simple health check endpoint
- Returns: `{"status": "ok", "timestamp": "..."}`

## Updating Functions

After making changes to `functions/src/index.ts`:

```bash
cd functions
npm run build
firebase deploy --only functions
```

## Costs

Firebase Cloud Functions pricing (pay-per-use):
- **Free tier**: 2 million invocations/month, 400,000 GB-seconds
- **After free tier**: ~$0.40 per million invocations

For typical usage (a few scans per day), costs should be minimal or free.

## Troubleshooting

### "Permission denied"
```bash
firebase login --reauth
```

### "Functions config not found"
Make sure you've set the config:
```bash
firebase functions:config:set perplexity.api_key="your_key"
```

### View Logs
```bash
firebase functions:log
```

Or in the Firebase Console: **Functions** → **Logs**

### CORS Errors
The functions include CORS handling. If issues persist, check that the request origin is allowed.

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    User's Browser                            │
│                                                              │
│  ┌─────────────┐     ┌─────────────────────────────────┐    │
│  │   Netlify   │     │   Firebase Cloud Functions      │    │
│  │   (Static   │     │   (Long-running scans)          │    │
│  │   hosting)  │     │   - scanMaterial (9 min max)    │    │
│  │             │────▶│   - Uses Perplexity AI          │    │
│  │  Next.js    │     │   - URL validation              │    │
│  │  Frontend   │     │   - Documentation search        │    │
│  └─────────────┘     └─────────────────────────────────┘    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

Netlify hosts the static Next.js site, while Firebase handles the heavy AI processing without timeout limits.


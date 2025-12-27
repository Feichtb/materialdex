# Deployment Guide: Netlify + GitHub

This guide walks you through deploying your Sustainable Materials Suggestor app to Netlify with proper security measures.

## Quick Start Summary

1. **GitHub**: Create repo → Push code
2. **Netlify**: Connect repo → Set environment variables → Deploy
3. **Security**: Rate limiting enabled, API keys protected

**Time estimate**: 15-20 minutes

## Prerequisites

- GitHub account
- Netlify account (free tier works)
- OpenAI API key
- Perplexity API key (optional but recommended)

## Step 1: Set Up GitHub Repository

### 1.1 Initialize Git (if not already done)

```bash
# Check if git is already initialized
git status

# If not initialized, run:
git init
```

### 1.2 Create a GitHub Repository

1. Go to [GitHub](https://github.com) and sign in
2. Click the "+" icon in the top right → "New repository"
3. Name it (e.g., `sustainable-materials-suggestor`)
4. Choose **Private** (recommended to protect your API keys)
5. **DO NOT** initialize with README, .gitignore, or license (we already have these)
6. Click "Create repository"

### 1.3 Connect Local Repository to GitHub

```bash
# Add all files (except those in .gitignore)
git add .

# Commit your changes
git commit -m "Initial commit: Ready for deployment"

# Add GitHub remote (replace YOUR_USERNAME and REPO_NAME)
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git

# Push to GitHub
git branch -M main
git push -u origin main
```

## Step 2: Configure Environment Variables

### 2.1 Create Environment Variables File Locally

Create a `.env.local` file in your project root (this file is already in .gitignore):

```env
# OpenAI API Key (required for GPT models)
OPENAI_API_KEY=your_openai_api_key_here

# Perplexity API Key (required for real-time product search)
PERPLEXITY_API_KEY=your_perplexity_api_key_here

# Optional: API Secret Key for protecting your API endpoints
# Generate a strong random string using: openssl rand -hex 32
API_SECRET_KEY=your_secure_random_string_here
```

**Important:** Never commit `.env.local` to Git! It's already in `.gitignore`.

### 2.2 Get Your API Keys

- **OpenAI API Key**: https://platform.openai.com/api-keys
- **Perplexity API Key**: https://www.perplexity.ai/settings/api

### 2.3 Generate API Secret Key (Optional but Recommended)

Generate a secure random string to protect your API endpoints:

```bash
# On Windows (PowerShell):
[Convert]::ToBase64String([System.Security.Cryptography.RandomNumberGenerator]::GetBytes(32))

# On Mac/Linux:
openssl rand -hex 32
```

Copy the generated string and use it as your `API_SECRET_KEY`.

## Step 3: Deploy to Netlify

### 3.1 Connect GitHub Repository to Netlify

1. Go to [Netlify](https://app.netlify.com) and sign in
2. Click "Add new site" → "Import an existing project"
3. Choose "GitHub" and authorize Netlify
4. Select your repository
5. Configure build settings:
   - **Build command**: `npm run build`
   - **Publish directory**: `.next`
   - **Node version**: `20` (or latest LTS)

### 3.2 Set Environment Variables in Netlify

1. In your Netlify site dashboard, go to **Site settings** → **Environment variables**
2. Add the following variables:

   ```
   OPENAI_API_KEY = your_openai_api_key_here
   PERPLEXITY_API_KEY = your_perplexity_api_key_here
   API_SECRET_KEY = your_generated_secret_key_here
   ```

3. Click "Save"

### 3.3 Deploy

1. Netlify will automatically trigger a build when you push to your main branch
2. Or click "Deploy site" to trigger a manual build
3. Wait for the build to complete (usually 2-5 minutes)

## Step 4: Security Configuration

### 4.1 API Key Protection

The middleware (`src/middleware.ts`) includes:

- **Rate limiting**: 20 requests per minute per IP address
  - **Note**: In-memory rate limiting works for single-instance deployments. For high-traffic sites, consider using Redis or Netlify's built-in rate limiting.
- **Optional API secret**: If `API_SECRET_KEY` is set, expensive endpoints require the secret
  - Public endpoints (`/api/verify`, `/api/verify-url`) remain accessible without the secret
  - Protected endpoints (`/api/scan`, `/api/scan-material`, `/api/search-epd`) require the secret if configured

### 4.2 Using API Secret Key (Optional)

**Important:** The `API_SECRET_KEY` is designed for **private/internal tools only**. If you set it:

1. **For private/internal apps**: Update your frontend to include the secret in API requests. However, note that exposing secrets in client-side code is not secure for truly public apps.

2. **For public apps**: Leave `API_SECRET_KEY` unset in Netlify. The middleware will skip the auth check, and you'll rely on rate limiting for protection.

**Current behavior:**
- If `API_SECRET_KEY` is **not set**: All endpoints are publicly accessible (with rate limiting)
- If `API_SECRET_KEY` **is set**: 
  - `/api/verify` and `/api/verify-url` remain public (no secret required)
  - `/api/scan`, `/api/scan-material`, `/api/search-epd` require the secret header

**Recommendation for public deployment:**
- Leave `API_SECRET_KEY` unset
- Rely on rate limiting (20 requests/minute per IP)
- Monitor API usage in OpenAI/Perplexity dashboards
- Set spending limits in your API provider accounts

### 4.3 Recommended: Use Netlify Functions for Extra Security

For production, consider moving API routes to Netlify Functions for better isolation and security.

## Step 5: Update Frontend (If Using API Secret)

If you enabled API secret protection, update your frontend to include the secret. However, **be careful**: exposing secrets in client-side code means anyone can see them.

**Better approach**: Only use API secret if you're building a private/internal tool. For public apps, rely on rate limiting and consider:
- User authentication
- API key per user
- Usage quotas

## Step 6: Custom Domain (Optional)

1. In Netlify dashboard → **Domain settings**
2. Click "Add custom domain"
3. Follow the DNS configuration instructions

## Step 7: Continuous Deployment

Every time you push to your `main` branch, Netlify will automatically:
1. Pull the latest code
2. Install dependencies
3. Build the app
4. Deploy to production

## Troubleshooting

### Build Fails

- Check Netlify build logs for errors
- Ensure all environment variables are set
- Verify `package.json` has correct build scripts

### API Routes Return 401 Unauthorized

- Check if `API_SECRET_KEY` is set in Netlify
- If set, ensure your frontend includes `x-api-secret` header
- Or remove `API_SECRET_KEY` from Netlify if you want public access

### Rate Limit Errors

- Default is 20 requests/minute per IP
- Adjust `RATE_LIMIT_MAX_REQUESTS` in `src/middleware.ts` if needed
- For production, consider using Redis-based rate limiting

### API Keys Not Working

- Verify keys are correctly set in Netlify environment variables
- Check for extra spaces or quotes
- Ensure keys are active and have sufficient credits

## Security Best Practices

1. ✅ **Never commit API keys** - They're in `.gitignore`
2. ✅ **Use environment variables** - Set them in Netlify, not in code
3. ✅ **Enable rate limiting** - Prevents abuse
4. ✅ **Use HTTPS** - Netlify provides this automatically
5. ✅ **Monitor usage** - Check OpenAI/Perplexity dashboards regularly
6. ✅ **Set spending limits** - Configure limits in OpenAI/Perplexity accounts
7. ⚠️ **Consider authentication** - For production apps, add user login

## Next Steps

- Set up monitoring and alerts
- Configure custom domain
- Add analytics (optional)
- Set up staging environment (create a separate Netlify site for testing)

## Support

If you encounter issues:
1. Check Netlify build logs
2. Check browser console for errors
3. Verify environment variables are set correctly
4. Review API key usage in OpenAI/Perplexity dashboards


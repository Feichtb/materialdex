# Quick Start: Deploy to Netlify

## Prerequisites Checklist

- [ ] GitHub account
- [ ] Netlify account (free tier works)
- [ ] OpenAI API key ([get one here](https://platform.openai.com/api-keys))
- [ ] Perplexity API key ([get one here](https://www.perplexity.ai/settings/api))

## Step-by-Step (15 minutes)

### 1. Push to GitHub (5 min)

```bash
# Initialize git (if not done)
git init

# Add all files
git add .

# Commit
git commit -m "Initial commit: Ready for deployment"

# Create repo on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/REPO_NAME.git
git branch -M main
git push -u origin main
```

### 2. Deploy to Netlify (10 min)

1. Go to [Netlify](https://app.netlify.com) → "Add new site" → "Import an existing project"
2. Connect GitHub → Select your repository
3. **Build settings** (usually auto-detected):
   - Build command: `npm run build`
   - Publish directory: `.next` (or leave blank - plugin handles it)
4. **Environment variables** → Add:
   ```
   OPENAI_API_KEY = your_key_here
   PERPLEXITY_API_KEY = your_key_here
   ```
   (Leave `API_SECRET_KEY` empty for public access)
5. Click "Deploy site"
6. Wait 2-5 minutes for build to complete

### 3. Test Your Deployment

- Visit your Netlify URL (e.g., `https://your-site.netlify.app`)
- Try scanning a material
- Check that API calls work

## Security Features Enabled

✅ **Rate limiting**: 20 requests/minute per IP  
✅ **API keys**: Stored securely in Netlify (never exposed)  
✅ **HTTPS**: Automatic via Netlify  
✅ **Security headers**: Configured in `netlify.toml`

## Troubleshooting

**Build fails?**
- Check Netlify build logs
- Verify environment variables are set
- Ensure Node version is 20+

**API returns 401?**
- Check if `API_SECRET_KEY` is set (remove it for public access)
- Verify `OPENAI_API_KEY` and `PERPLEXITY_API_KEY` are correct

**Rate limit errors?**
- Default: 20 requests/minute per IP
- Adjust in `src/middleware.ts` if needed

## Next Steps

- Set up custom domain
- Configure spending limits in OpenAI/Perplexity
- Monitor API usage
- See `DEPLOYMENT.md` for detailed guide


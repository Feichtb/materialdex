# Configuring the Web App URL

The Revit plugin needs to know where to connect to the Materialdex web app.

## Quick Configuration

1. Open `RevitPlugin/MaterialdexDockablePane.xaml.cs`
2. Find line ~25 where it says:
   ```csharp
   private const string PRODUCTION_URL = "https://your-site-name.netlify.app";
   ```
3. Replace `https://your-site-name.netlify.app` with your actual Netlify URL
4. Make sure `USE_PRODUCTION = true` (line ~30)
5. Rebuild the plugin

## Finding Your Netlify URL

1. Go to your Netlify dashboard: https://app.netlify.com
2. Click on your site
3. Your site URL is shown at the top (e.g., `https://materialdex-abc123.netlify.app`)
4. Or check the "Domain settings" for a custom domain

## Development vs Production

- **Production mode** (`USE_PRODUCTION = true`): Uses your Netlify URL
- **Development mode** (`USE_PRODUCTION = false`): Uses `http://localhost:3000` for local development

## After Changing the URL

1. Rebuild the plugin:
   ```cmd
   cd RevitPlugin
   build.bat
   ```
2. Reinstall the plugin (copy new DLL to Revit Add-Ins folder)
3. Restart Revit

## Testing

After updating the URL, test that:
- The plugin loads the web app successfully
- Materials can be extracted from Revit
- The web app can communicate with Revit


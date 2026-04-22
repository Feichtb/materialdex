# Materialdex - Sustainable Materials Suggestor

## Project Overview
Materialdex is a Revit plugin + web app that helps architects find sustainable building material alternatives. The plugin scans a Revit model's materials and surfaces product recommendations with EPD, HPD, Declare, and VOC documentation links via an AI-powered web interface.

## Architecture
Two-part system:
1. **Revit Plugin** (`RevitPlugin/`) - C# WPF plugin using WebView2 to embed the web app inside a Revit dockable pane
2. **Web App** (`src/`) - Next.js 14 app (TypeScript, Tailwind) deployed to Netlify at `https://materialdex.netlify.app`. Uses Perplexity API (Sonar Pro) for real-time product search, OpenAI GPT-4.1 as fallback.

Communication: Revit <-> WebView2 JavaScript bridge (postMessage). Revit sends materials/theme/project info; web app requests scans and displays results.

## Revit Plugin (`RevitPlugin/`)

### Key Files
- `App.cs` - IExternalApplication entry point. Creates ribbon panel, registers dockable pane, handles Idling event for document change detection.
- `MaterialExtractor.cs` - Static class that extracts materials from Revit documents with quantities (area in sq ft) using FilteredElementCollector and geometry traversal.
- `MaterialdexDockablePane.xaml.cs` - WPF UserControl hosting WebView2. Manages JS bridge, material caching, theme sync, retry logic.
- `MaterialdexDockablePane.xaml` - Minimal XAML with dark background and WebView2 control.
- `Materialdex.addin` - Revit add-in manifest (ClientId: E8F5C9A2-3B7D-4E6F-8A1C-9D2E3F4B5C6A).
- `PackageContents.xml` - Autodesk Application Plug-in Package manifest (bundle format, used for direct distribution).
- `Help.html` - User-facing help documentation (bundled with plugin).
- `License.txt` - MIT License.

### Build & Deploy
- **Framework:** .NET 8.0, WPF, x64 only
- **Target Revit:** 2025 and up
- **NuGet:** Microsoft.Web.WebView2 v1.0.2739.15, Newtonsoft.Json v13.0.3
- **Build:** `dotnet build Materialdex.csproj -c Release` or use `build.bat`
- **Package for release:** `package-for-store.bat` creates `Materialdex.bundle/` structure
- **Create ZIP:** `create-zip.bat` creates `Materialdex-2.0.0.zip` (uploaded to GitHub Releases)
- **Install locally:** `install.bat` copies to `%APPDATA%\Autodesk\Revit\Addins\2026\`

### Bundle Structure (for GitHub Releases distribution)
```
Materialdex.bundle/
  PackageContents.xml
  Contents/
    Materialdex.dll, Materialdex.addin, Materialdex.deps.json
    Microsoft.Web.WebView2.*.dll, Newtonsoft.Json.dll
    runtimes/win-{x64,x86,arm64}/native/WebView2Loader.dll
    Resources/materialdex-{16,32}.png
    Help.html, License.txt
```

### Key Constants & IDs
- Dockable Pane GUID: `B8E5C9A2-3B7D-4E6F-8A1C-9D2E3F4B5C6B`
- Client ID: `E8F5C9A2-3B7D-4E6F-8A1C-9D2E3F4B5C6A`
- Production URL: `https://materialdex.netlify.app`
- WebView2 cache: `%LocalAppData%\Materialdex\WebView2`

## Web App (`src/`)

### Key Files
- `src/app/page.tsx` - Main page
- `src/app/layout.tsx` - Root layout
- `src/app/api/scan-material/` - POST endpoint for single material scan (Perplexity/OpenAI), streaming SSE
- `src/app/api/usage/` - GET/POST endpoint for tracking free scan count per device via Netlify Blobs
- `src/app/api/scan/` - Bulk scan endpoint (legacy)
- `src/app/api/verify/` - URL verification endpoint

### Environment Variables
- `PERPLEXITY_API_KEY` - Required for real-time product search (server-side, funds the free tier)
- `OPENAI_API_KEY` - Optional fallback

### Usage Limits
- `FREE_SCAN_LIMIT = 50` in `src/app/api/usage/route.ts` — 50 free scans per device
- After the limit, users supply their own Perplexity key (BYOK) in app settings
- Usage tracked via Netlify Blobs keyed by `deviceId`; silently skipped in local dev

### Run Development
```bash
npm install
npm run dev  # localhost:3000
```

## Marketing Site (`marketing-site/`)
Landing page / blog post, deployed as a separate Netlify site from the same GitHub repo. Contains a download button (`Closing` section, `materialdex.jsx`) that should link to the GitHub releases page — currently a placeholder `href="#"`.

## Commands
- Build plugin: `cd RevitPlugin && dotnet build -c Release`
- Run web app: `npm run dev`
- Package for release: `cd RevitPlugin && package-for-store.bat`

## Distribution
Distributed directly via GitHub Releases — not via Autodesk App Store (decided against due to $150/yr code-signing requirement). Plugin is open source (MIT). Users install by copying `Materialdex.bundle` to their Autodesk ApplicationPlugins folder.

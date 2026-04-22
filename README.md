# Materialdex — Sustainable Materials Suggestor

A free Revit plugin that helps architects find sustainable building material alternatives. It scans your model's materials and surfaces product recommendations with EPD, HPD, Declare, and VOC documentation links, powered by AI-driven real-time search.

## Features

- **Material scanning** — Extracts materials and quantities from your active Revit document
- **AI-powered product search** — Finds real sustainable alternatives with live web search via Perplexity
- **Documentation links** — EPD, HPD, Declare, and VOC certifications located from primary sources
- **50 free scans included** — After that, add your own Perplexity API key for unlimited use

## Supported Versions

Revit 2025 and 2026 · Windows 64-bit

## Installation

1. Download `Materialdex-v2.0.0.zip` from the [Releases page](../../releases)
2. Extract the ZIP
3. Copy the `Materialdex.bundle` folder to one of these locations:
   - **Per-user** (recommended): `%AppData%\Autodesk\ApplicationPlugins\`
   - **Per-machine** (admin required): `%ProgramData%\Autodesk\ApplicationPlugins\`
4. Launch Revit — look for the **Materialdex** tab in the ribbon

Full details: [RevitPlugin/INSTALLATION_INSTRUCTIONS.md](RevitPlugin/INSTALLATION_INSTRUCTIONS.md)

## Usage

1. Open a Revit project
2. Click **Show Materialdex** in the ribbon to open the panel
3. Click **Extract Materials** to load the model's materials
4. Select a material and click **Find Products**
5. Review recommendations, expand cards to see documentation links, and bookmark products to your library

### Free Scan Limit

The hosted API includes **50 free scans per device**. After that, add your own [Perplexity API key](https://www.perplexity.ai/settings/api) in the app settings (approximately $0.08 per scan using sonar-pro).

## Architecture

Two-part system:

| Component | Location | Description |
|-----------|----------|-------------|
| Revit Plugin | `RevitPlugin/` | C# WPF plugin, embeds the web app in a dockable pane via WebView2 |
| Web App | `src/` | Next.js 14 app, deployed at [materialdex.netlify.app](https://materialdex.netlify.app) |

The plugin sends materials, theme, and project info to the web app via a JavaScript bridge (postMessage). The web app handles all AI calls server-side.

## For Developers

### Web app (local dev)

```bash
npm install
npm run dev   # http://localhost:3000
```

Create `.env.local` with your API keys:

```
PERPLEXITY_API_KEY=pplx-...
OPENAI_API_KEY=sk-...        # optional fallback
```

### Building the Revit plugin

Requires .NET 8 SDK and Revit 2025 or 2026 installed at the default path.

```cmd
cd RevitPlugin
build.bat     # builds Release configuration
install.bat   # copies to %APPDATA%\Autodesk\Revit\Addins\2026\
```

For the bundle format (used for distribution):

```cmd
cd RevitPlugin
package-for-store.bat   # creates Materialdex.bundle/
create-zip.bat          # creates Materialdex-v2.0.0.zip
```

See [RevitPlugin/README.md](RevitPlugin/README.md) for full developer setup.

## Marketing Site

The `marketing-site/` folder contains the landing page / blog post, deployed to Netlify from the same repository.

## License

MIT — see [RevitPlugin/License.txt](RevitPlugin/License.txt)

## Contact

Questions or feedback: ben.materialdex@gmail.com

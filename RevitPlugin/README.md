# Materialdex Revit Plugin

This is the Revit 2026 plugin for Materialdex - a sustainable building materials recommendation tool.

## Prerequisites

Before building and running the plugin, you need:

### 1. .NET 8 SDK
Download and install from: https://dotnet.microsoft.com/download/dotnet/8.0

To verify installation:
```cmd
dotnet --version
```

### 2. Revit 2026
The plugin references Revit 2026 API assemblies from the default installation path:
- `C:\Program Files\Autodesk\Revit 2026\`

### 3. WebView2 Runtime 
Usually pre-installed on Windows 10/11. If not:
https://developer.microsoft.com/en-us/microsoft-edge/webview2/

### 4. Visual Studio 2022 (Optional)
For development and debugging. Community edition is free:
https://visualstudio.microsoft.com/

## Quick Start

### Option 1: Command Line Build

```cmd
cd RevitPlugin
build.bat
install.bat
```

cd RevitPlugin
dotnet build Materialdex.csproj -c Release
install.bat

### Option 2: Visual Studio

1. Open `Materialdex.sln` in Visual Studio 2022
2. Build the solution (Ctrl+Shift+B)
3. Run `install.bat` to install to Revit

## Running the Plugin

1. **Launch Revit 2025 or 2026**

2. **Find Materialdex** in the ribbon:
   - Look for the **Materialdex** tab
   - Click **Show Materialdex** to open the panel

3. **Extract Materials** from your model:
   - Click **Extract Materials** to scan the current document
   - Materials appear in the Materialdex panel

The plugin connects to the hosted web app at `materialdex.netlify.app`. No local server needed. If you want to run a local version of the web app for development, see the root README.

## Running Locally (Development)

To point the plugin at a local web app:

1. In `MaterialdexDockablePane.xaml.cs`, set `USE_PRODUCTION = false`
2. Run the Next.js app from the repo root: `npm run dev`
3. Rebuild and reinstall the plugin

## Project Structure

```
RevitPlugin/
├── App.cs                        # Main plugin entry point
├── MaterialExtractor.cs          # Extracts materials from Revit model
├── MaterialdexDockablePane.xaml  # WPF panel with WebView2
├── MaterialdexDockablePane.xaml.cs
├── Materialdex.addin             # Revit manifest file
├── Materialdex.csproj            # Project file
├── Materialdex.sln               # Solution file
├── build.bat                     # Build script
├── install.bat                   # Installation script
└── Resources/
    ├── materialdex-16.png        # Small icon (16x16)
    └── materialdex-32.png        # Large icon (32x32)
```

## Plugin Features

### 1. Dockable Panel
- Hosts the Materialdex web app inside Revit
- WebView2-based for modern web compatibility
- Refresh and "Open in Browser" buttons

### 2. Material Extraction
- Scans the active Revit document for materials
- Calculates material areas
- Categorizes materials automatically
- Sends data to the web interface

### 3. Revit-Web Communication
- JavaScript bridge for bi-directional communication
- Materials extracted from Revit appear in the Materialdex web app
- Future: Save recommendations back to Revit

## Troubleshooting

### "WebView2 Runtime not found"
Install from: https://developer.microsoft.com/microsoft-edge/webview2/

### "Cannot connect to localhost:3000"
Make sure the Next.js dev server is running:
```cmd
cd ..  # Go to main project folder
npm run dev
```

### "RevitAPI.dll not found"
Ensure Revit 2026 is installed, or update the paths in `Materialdex.csproj`:
```xml
<HintPath>YOUR_REVIT_PATH\RevitAPI.dll</HintPath>
```

### Build Errors
Ensure you have .NET 8 SDK installed:
```cmd
dotnet --list-sdks
```

### Plugin not appearing in Revit
1. Check that `Materialdex.addin` is in `%APPDATA%\Autodesk\Revit\Addins\2026\`
2. Check that the plugin DLL is in `%APPDATA%\Autodesk\Revit\Addins\2026\Materialdex\`
3. Check Revit's Add-ins dialog for loading errors

## Development

### Debugging
1. Build in Debug configuration
2. Attach Visual Studio to Revit.exe
3. Set breakpoints in the C# code

### Hot Reload (Web App)
The Next.js app supports hot reload - changes appear immediately without restarting Revit.

### Updating the Plugin
After code changes:
1. Close Revit
2. Rebuild: `build.bat`
3. Reinstall: `install.bat`
4. Restart Revit

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                     Revit 2026                          │
│  ┌─────────────────────────────────────────────────┐    │
│  │            Materialdex Plugin                   │    │
│  │  ┌─────────────┐  ┌─────────────────────────┐   │    │
│  │  │   Ribbon    │  │   Dockable Panel        │   │    │
│  │  │   Buttons   │  │   (WebView2)            │   │    │
│  │  │             │  │   ┌─────────────────┐   │   │    │
│  │  │ [Show]      │  │   │ Next.js App     │   │   │    │
│  │  │ [Extract]   │  │   │ (localhost:3000)│   │   │    │
│  │  │             │  │   └─────────────────┘   │   │    │
│  │  └─────────────┘  └─────────────────────────┘   │    │
│  │                            ▲                     │    │
│  │  ┌─────────────────────────┼─────────────────┐   │    │
│  │  │    Material Extractor   │                 │   │    │
│  │  │    (Revit API)          │ JS Bridge       │   │    │
│  │  └─────────────────────────┴─────────────────┘   │    │
│  └─────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────┘
```

## Release Package

The plugin is packaged as an Autodesk Application Plug-in Package (`.bundle`) for distribution via GitHub Releases.

### Bundle Structure

```
Materialdex.bundle/
├── PackageContents.xml          # Package manifest
└── Contents/                     # Plugin files
    ├── Materialdex.dll
    ├── Materialdex.addin
    ├── [dependencies...]
    ├── Resources/
    ├── Help.html
    └── License.txt
```

### Creating the Bundle Package

1. **Build Release version:**
   ```cmd
   dotnet build Materialdex.csproj -c Release
   ```

2. **Package for release:**
   ```cmd
   package-for-store.bat
   ```

3. **Create ZIP file:**
   ```cmd
   create-zip.bat
   ```

### Installing the Bundle

**Option 1: Use installer script**
```cmd
install-bundle.bat
```

**Option 2: Manual installation**
Copy `Materialdex.bundle` to:
- `%AppData%\Autodesk\ApplicationPlugins\` (per-user)
- `%ProgramData%\Autodesk\ApplicationPlugins\` (per-machine)

See `BUNDLE_README.md` and `APP_STORE_SUBMISSION.md` for detailed information.

## License

MIT


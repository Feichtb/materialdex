# Materialdex Bundle Package

This folder contains the Autodesk Application Plug-in Package (`.bundle`) format for the Materialdex Revit plugin, ready for distribution via the Autodesk App Store.

## Bundle Structure

```
Materialdex.bundle/
├── PackageContents.xml          # Package manifest (required)
└── Contents/                     # Plugin files folder
    ├── Materialdex.dll           # Main plugin assembly
    ├── Materialdex.addin        # Revit add-in manifest (optional for bundles)
    ├── SustainSpec.dll          # Supporting library
    ├── Microsoft.Web.WebView2.*.dll  # WebView2 dependencies
    ├── Newtonsoft.Json.dll      # JSON library
    ├── Resources/               # Plugin icons
    │   ├── materialdex-16.png
    │   └── materialdex-32.png
    ├── runtimes/               # WebView2 native runtimes
    │   ├── win-x64/
    │   ├── win-x86/
    │   └── win-arm64/
    ├── Help.html               # User documentation
    └── License.txt             # MIT License
```

## Installation

### Automatic Installation (Recommended)

Use the installer script:
```cmd
install-bundle.bat
```

This will copy the bundle to the appropriate Autodesk ApplicationPlugins folder.

### Manual Installation

Copy the `Materialdex.bundle` folder to one of these locations:

**Per User (Recommended):**
```
%AppData%\Autodesk\ApplicationPlugins\
```

**Per Machine (Requires Admin):**
```
%ProgramData%\Autodesk\ApplicationPlugins\
```

After copying, restart Revit 2026. The plugin will appear in the "Materialdex" ribbon tab.

## Package Creation

To rebuild the bundle package:

1. **Build the Release version:**
   ```cmd
   dotnet build Materialdex.csproj -c Release
   ```

2. **Run the packaging script:**
   ```cmd
   package-for-store.bat
   ```

3. **Create ZIP for distribution:**
   ```cmd
   create-zip.bat
   ```

## Package Contents

### PackageContents.xml

The main manifest file that defines:
- Plugin metadata (name, version, description)
- Company information
- Runtime requirements (Revit 2026, Windows 64-bit)
- Component registration

### Contents Folder

Contains all plugin files:
- **DLLs:** Main plugin and dependencies
- **Resources:** Icons for the Revit ribbon
- **Runtimes:** WebView2 native libraries for different architectures
- **Documentation:** Help.html and License.txt

## Verification

After installation, verify the plugin:

1. Launch Revit 2026
2. Check for "Materialdex" tab in the ribbon
3. Open Revit's Add-ins dialog: **Manage → Add-ins**
4. Verify Materialdex appears in the list without errors

## Troubleshooting

### Plugin Not Loading

- Verify bundle is in correct location
- Check PackageContents.xml for syntax errors
- Ensure all DLLs are present in Contents folder
- Check Revit Add-ins dialog for error messages

### Missing Dependencies

- Ensure all NuGet package DLLs are included
- WebView2 runtimes should be in `runtimes\` folder
- Test on clean machine without Visual Studio installed

### WebView2 Errors

- WebView2 Runtime may need to be installed separately
- Download from: https://developer.microsoft.com/microsoft-edge/webview2/
- Usually pre-installed on Windows 10/11

## App Store Submission

See `APP_STORE_SUBMISSION.md` for detailed submission instructions.

## Version Information

- **Version:** 1.0.0
- **Revit Version:** 2026
- **.NET Version:** 8.0
- **Platform:** Windows 64-bit

## Support

For issues or questions:
- Email: support@materialdex.com
- Website: https://materialdex.com


# Autodesk App Store Submission Guide

This document provides instructions for submitting the Materialdex Revit plugin to the Autodesk App Store.

## Package Structure

The plugin is packaged as a `.bundle` folder following Autodesk's Application Plug-in Package format:

```
Materialdex.bundle/
├── PackageContents.xml          # Main package manifest
└── Contents/
    ├── Materialdex.dll          # Main plugin assembly
    ├── Materialdex.addin        # Revit add-in manifest
    ├── SustainSpec.dll          # Supporting library
    ├── Microsoft.Web.WebView2.*.dll  # WebView2 dependencies
    ├── Newtonsoft.Json.dll      # JSON library
    ├── Resources/               # Icons
    │   ├── materialdex-16.png
    │   └── materialdex-32.png
    ├── runtimes/               # WebView2 native runtimes
    ├── Help.html               # User documentation
    └── License.txt             # MIT License
```

## Pre-Submission Checklist

- [x] Plugin builds successfully in Release mode
- [x] PackageContents.xml is properly configured
- [x] All dependencies are included in the bundle
- [x] Help documentation is included (Help.html)
- [x] License file is included
- [x] Icons are included (16x16 and 32x32 PNG)
- [x] Plugin tested on clean Revit 2026 installation
- [x] No PDB files included in release package

## Creating the Submission Package

### Option 1: Using the Package Script

Run the packaging script:
```cmd
cd RevitPlugin
package-for-store.bat
```

This will:
1. Build the Release version
2. Copy all necessary files to the bundle
3. Verify the bundle structure

### Option 2: Manual Packaging

1. Build the Release version:
   ```cmd
   dotnet build Materialdex.csproj -c Release
   ```

2. Copy files to `Materialdex.bundle\Contents\`:
   - All DLLs from `bin\Release\` (except .pdb files)
   - `Materialdex.addin`
   - `Resources\` folder
   - `runtimes\` folder

3. Verify `PackageContents.xml` is in `Materialdex.bundle\`

## Creating the ZIP File

Create a ZIP archive of the `Materialdex.bundle` folder:

```cmd
cd RevitPlugin
powershell Compress-Archive -Path Materialdex.bundle -DestinationPath Materialdex-v1.0.0.zip -Force
```

**Important:** Zip the `.bundle` folder itself, not its contents. The ZIP should contain:
```
Materialdex-v1.0.0.zip
└── Materialdex.bundle/
    ├── PackageContents.xml
    └── Contents/
        └── ...
```

## Testing the Bundle Locally

Before submission, test the bundle:

1. **Install locally:**
   ```cmd
   install-bundle.bat
   ```
   Or manually copy `Materialdex.bundle` to:
   - `%AppData%\Autodesk\ApplicationPlugins\` (per-user)
   - `%ProgramData%\Autodesk\ApplicationPlugins\` (per-machine)

2. **Launch Revit 2026** and verify:
   - Plugin appears in the ribbon
   - Dockable panel opens correctly
   - Material extraction works
   - No errors in Revit's Add-ins dialog

## App Store Submission Requirements

### Required Information

1. **App Name:** Materialdex
2. **Version:** 1.0.0
3. **Description:** 
   ```
   Sustainable Materials Suggestor - Find eco-friendly building material 
   alternatives with EPD, HPD, Declare, and VOC documentation. Extract 
   materials from your Revit models and get verified sustainable product 
   recommendations with real manufacturer links and environmental documentation.
   ```

4. **Category:** Productivity / Sustainability
5. **Supported Products:** Revit 2026
6. **Supported OS:** Windows 64-bit
7. **Pricing:** Free / Paid (specify)
8. **Company Information:**
   - Name: Materialdex
   - Website: https://materialdex.com
   - Email: support@materialdex.com

### Required Files

1. **Plugin Package:** `Materialdex-v1.0.0.zip` (the bundle ZIP)
2. **Screenshots:** 
   - Plugin in Revit ribbon
   - Dockable panel showing the interface
   - Material extraction in action
   - Product recommendations view
   - Minimum 3-5 screenshots recommended
3. **App Icon:** 
   - 120x120 pixels (PNG)
   - 24x24 pixels (PNG)
   - Already available in project root
4. **Promotional Image:** 
   - 1920x1080 pixels (optional but recommended)
5. **Help Documentation:** Already included as Help.html

### Submission Process

1. **Create Publisher Account:**
   - Visit: https://aps.autodesk.com/app-store/publisher-center
   - Sign up or log in
   - Complete publisher profile

2. **Submit New App:**
   - Click "Submit New App"
   - Select "Revit" as the product
   - Fill in all required fields
   - Upload the ZIP package
   - Upload screenshots and icons
   - Provide detailed description

3. **Review Process:**
   - Autodesk will review your submission
   - They may request changes or additional information
   - Typical review time: 2-4 weeks

## PackageContents.xml Details

The `PackageContents.xml` file includes:

- **ApplicationPackage:** General plugin information
- **CompanyDetails:** Your company information
- **RuntimeRequirements:** Revit 2026, Windows 64-bit
- **AppPackageExtension:** Revit-specific add-in configuration
  - AddInId: E8F5C9A2-3B7D-4E6F-8A1C-9D2E3F4B5C6A
  - FullClassName: Materialdex.App
  - Assembly: Materialdex.dll

## Common Issues and Solutions

### Issue: Plugin not loading after installation
**Solution:** 
- Verify bundle is in correct location
- Check PackageContents.xml syntax
- Ensure all DLLs are included
- Check Revit Add-ins dialog for errors

### Issue: WebView2 runtime error
**Solution:** 
- WebView2 is included in the bundle
- Users may need to install WebView2 Runtime separately if not pre-installed
- Document this in the app description

### Issue: Missing dependencies
**Solution:**
- Ensure all NuGet package DLLs are copied
- Include WebView2 runtimes for all architectures (x64, x86, arm64)
- Test on clean machine without Visual Studio

## Post-Submission

After submission:

1. Monitor the Publisher Center for review status
2. Respond promptly to any Autodesk requests
3. Prepare for potential updates based on feedback
4. Plan marketing and promotion once approved

## Support

For questions about the submission process:
- Autodesk App Store Support: appsubmissions@autodesk.com
- Publisher Center: https://aps.autodesk.com/app-store/publisher-center

## Version History

- **1.0.0** - Initial release for Revit 2026


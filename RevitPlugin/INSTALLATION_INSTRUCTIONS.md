# Materialdex Installation Instructions

## Supported Versions

**Revit 2026** (Windows 64-bit)

The plugin is currently built for Revit 2026. Future versions may support additional Revit releases.

## Installation Methods

### Method 1: Manual Installation (Recommended for App Store)

1. **Download** the `Materialdex-v1.0.0.zip` file
2. **Extract** the ZIP file to a temporary location
3. **Copy** the `Materialdex.bundle` folder to one of these locations:
   - **Per User** (Recommended): `%AppData%\Autodesk\ApplicationPlugins\`
     - Full path: `C:\Users\[YourUsername]\AppData\Roaming\Autodesk\ApplicationPlugins\`
   - **Per Machine** (Requires Admin): `%ProgramData%\Autodesk\ApplicationPlugins\`
     - Full path: `C:\ProgramData\Autodesk\ApplicationPlugins\`
4. **Launch Revit 2026**
5. Look for the **"Materialdex"** tab in the Revit ribbon

### Method 2: Using the Installer Script (For Developers)

If you have the source code, you can use the installer script:

1. Extract the ZIP file
2. Navigate to the `RevitPlugin` folder
3. Run `install-bundle.bat`
4. Launch Revit 2026

## Verification

After installation, verify the plugin loaded correctly:

1. Open Revit 2026
2. Go to **Manage → Add-ins**
3. Look for "Materialdex" in the list
4. Check that there are no error messages
5. Verify the "Materialdex" tab appears in the ribbon

## Uninstallation

To uninstall the plugin:

1. Close Revit 2026
2. Delete the `Materialdex.bundle` folder from:
   - `%AppData%\Autodesk\ApplicationPlugins\` (per-user)
   - OR `%ProgramData%\Autodesk\ApplicationPlugins\` (per-machine)
3. Restart Revit

## Troubleshooting

### Plugin Not Appearing

- Verify the bundle folder is in the correct location
- Check that you're using Revit 2026
- Restart Revit after installation
- Check Revit's Add-ins dialog for error messages

### WebView2 Runtime Error

If you see a WebView2 error:
1. Download WebView2 Runtime from: https://developer.microsoft.com/microsoft-edge/webview2/
2. Install it
3. Restart Revit

### Permission Errors

If you get permission errors when copying:
- Try the per-user location (`%AppData%`) instead of per-machine
- Run File Explorer as Administrator if using per-machine location

## System Requirements

- **Revit:** 2026
- **OS:** Windows 10/11 (64-bit)
- **.NET:** 8.0 Runtime (usually included with Revit 2026)
- **WebView2:** Runtime (usually pre-installed on Windows 10/11)

## Notes

- The plugin requires an internet connection to access the Materialdex web application
- Material extraction works with the active Revit document
- The plugin automatically loads when Revit starts (no manual activation needed)


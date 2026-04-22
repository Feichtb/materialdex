# Materialdex Installation Instructions

## Supported Versions

**Revit 2025 and up** (Windows 64-bit)

## Installation

### Step 1: Download

Download `Materialdex-v2.0.0.zip` from the [GitHub Releases page](https://github.com/Feichtb/materialdex/releases).

### Step 2: Copy the bundle

Extract the ZIP and copy the `Materialdex.bundle` folder to one of these locations:

**Per-user (recommended):**
```
%AppData%\Autodesk\ApplicationPlugins\
```
Full path: `C:\Users\[YourUsername]\AppData\Roaming\Autodesk\ApplicationPlugins\`

**Per-machine (requires admin):**
```
%ProgramData%\Autodesk\ApplicationPlugins\
```
Full path: `C:\ProgramData\Autodesk\ApplicationPlugins\`

### Step 3: Launch Revit

Start Revit. The **Materialdex** tab will appear in the ribbon automatically.

## Verification

To confirm the plugin loaded correctly:

1. Open Revit
2. Go to **Manage → Add-ins**
3. Look for "Materialdex" in the list with no error messages
4. Confirm the **Materialdex** tab appears in the ribbon

## Uninstalling

1. Close Revit
2. Delete the `Materialdex.bundle` folder from the location you installed it
3. Restart Revit

## Troubleshooting

### Plugin tab not appearing

- Confirm the bundle folder is in the correct location (not inside a subfolder)
- Confirm you're using Revit 2025 or later
- Restart Revit after installation
- Check **Manage → Add-ins** for error messages

### WebView2 runtime error

WebView2 is usually pre-installed on Windows 10/11. If you see an error:

1. Download from: https://developer.microsoft.com/microsoft-edge/webview2/
2. Install and restart Revit

### Permission errors when copying

Use the per-user location (`%AppData%`) — it does not require admin rights.

## System Requirements

| Requirement | Details |
|------------|---------|
| Revit | 2025 and up |
| OS | Windows 10 or 11 (64-bit) |
| .NET | 8.0 Runtime (included with Revit) |
| WebView2 | Pre-installed on Windows 10/11 |
| Internet | Required (plugin connects to the hosted web app) |

## Notes

- The plugin requires an active internet connection to reach the hosted web app
- **50 free scans** are included. After that, add your own Perplexity API key in the app settings (≈ $0.08/scan)
- Material extraction works only with the active Revit document
- The plugin loads automatically when Revit starts

@echo off
REM Materialdex Revit Plugin - Package for Autodesk App Store
REM This script prepares the plugin bundle for submission to the Autodesk App Store

echo ========================================
echo Materialdex - Package for App Store
echo ========================================
echo.

REM Check if Release build exists
if not exist "bin\Release\Materialdex.dll" (
    echo ERROR: Release build not found!
    echo Please build the plugin first:
    echo   dotnet build Materialdex.csproj -c Release
    echo.
    pause
    exit /b 1
)

echo Step 1: Cleaning previous build and bundle...
REM Clean build output to remove stale files from old builds
dotnet clean Materialdex.csproj -c Release >nul 2>&1
if exist "Materialdex.bundle" rmdir /s /q "Materialdex.bundle"

echo.
echo Step 2: Building Release version...
call build.bat
if %errorLevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Step 3: Creating bundle structure...
mkdir "Materialdex.bundle\Contents"

echo.
echo Step 4: Copying plugin files...
REM Create exclude file for PDB files, then copy DLLs and dependencies
REM (xcopy /EXCLUDE matches substrings, so .pdb matches any path containing .pdb)
echo .pdb> exclude.txt
xcopy /E /I /Y "bin\Release\*" "Materialdex.bundle\Contents\" /EXCLUDE:exclude.txt
del exclude.txt

REM Copy .addin file
if exist "Materialdex.addin" (
    copy /Y "Materialdex.addin" "Materialdex.bundle\Contents\"
)

REM Copy documentation files (from RevitPlugin folder)
if exist "Help.html" (
    copy /Y "Help.html" "Materialdex.bundle\Contents\"
)
if exist "License.txt" (
    copy /Y "License.txt" "Materialdex.bundle\Contents\"
)

REM Copy PackageContents.xml to bundle root (required for ApplicationPlugins)
if exist "PackageContents.xml" (
    copy /Y "PackageContents.xml" "Materialdex.bundle\"
) else (
    echo ERROR: PackageContents.xml not found in RevitPlugin folder!
    pause
    exit /b 1
)

echo.
echo Step 5: Verifying bundle structure...
if not exist "Materialdex.bundle\PackageContents.xml" (
    echo ERROR: PackageContents.xml not found!
    pause
    exit /b 1
)

if not exist "Materialdex.bundle\Contents\Materialdex.dll" (
    echo ERROR: Materialdex.dll not found in Contents folder!
    pause
    exit /b 1
)

echo.
echo ========================================
echo Package created successfully!
echo ========================================
echo.
echo Bundle location: Materialdex.bundle
echo.
echo Contents:
dir /B "Materialdex.bundle"
echo.
dir /B "Materialdex.bundle\Contents"
echo.
echo Next steps:
echo 1. (Recommended) Sign the DLL: set SIGNTOOL_CERT_PATH=your.pfx then sign-dll.bat
echo    See DIGITAL_SIGNATURE.md for certificate setup.
echo 2. Review PackageContents.xml
echo 3. Test the bundle by installing it locally (install-bundle.bat)
echo 4. Create a ZIP file: create-zip.bat
echo 5. Submit to Autodesk App Store Publisher Center
echo    https://aps.autodesk.com/app-store/publisher-center
echo.
pause


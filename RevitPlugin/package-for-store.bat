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

echo Step 1: Building Release version...
call build.bat
if %errorLevel% neq 0 (
    echo Build failed!
    pause
    exit /b 1
)

echo.
echo Step 2: Creating bundle structure...
if not exist "Materialdex.bundle\Contents" (
    mkdir "Materialdex.bundle\Contents"
)

echo.
echo Step 3: Copying plugin files...
REM Copy DLLs and dependencies (excluding PDB files)
xcopy /E /I /Y "bin\Release\*" "Materialdex.bundle\Contents\" /EXCLUDE:exclude.txt
if exist exclude.txt del exclude.txt

REM Create exclude file for PDB files
echo *.pdb > exclude.txt
xcopy /E /I /Y "bin\Release\*" "Materialdex.bundle\Contents\" /EXCLUDE:exclude.txt
del exclude.txt

REM Copy .addin file
if exist "Materialdex.addin" (
    copy /Y "Materialdex.addin" "Materialdex.bundle\Contents\"
)

echo.
echo Step 4: Verifying bundle structure...
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
echo 1. Review PackageContents.xml
echo 2. Test the bundle by installing it locally
echo 3. Create a ZIP file of Materialdex.bundle
echo 4. Submit to Autodesk App Store Publisher Center
echo    https://aps.autodesk.com/app-store/publisher-center
echo.
pause


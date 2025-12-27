@echo off
REM Materialdex Revit Plugin Installation Script
REM Copies the built plugin to Revit 2026 addins folder

echo.
echo ========================================
echo  Materialdex Revit Plugin Installation
echo ========================================
echo.

set REVIT_ADDINS=%APPDATA%\Autodesk\Revit\Addins\2026
set PLUGIN_FOLDER=%REVIT_ADDINS%\Materialdex
set SOURCE_FOLDER=%~dp0bin\Release

REM Check if build exists
if not exist "%SOURCE_FOLDER%\Materialdex.dll" (
    echo ERROR: Build not found. Please run build.bat first.
    echo Looking for: %SOURCE_FOLDER%\Materialdex.dll
    exit /b 1
)

REM Create Revit addins folder if it doesn't exist
if not exist "%REVIT_ADDINS%" (
    echo Creating Revit addins folder: %REVIT_ADDINS%
    mkdir "%REVIT_ADDINS%"
)

REM Create plugin folder
if not exist "%PLUGIN_FOLDER%" (
    echo Creating plugin folder: %PLUGIN_FOLDER%
    mkdir "%PLUGIN_FOLDER%"
)

REM Copy plugin files
echo Copying plugin files...
xcopy /Y /E /I "%SOURCE_FOLDER%\*" "%PLUGIN_FOLDER%\"

REM Copy addin manifest
echo Copying addin manifest...
copy /Y "%~dp0Materialdex.addin" "%REVIT_ADDINS%\"

echo.
echo ========================================
echo  Installation Complete!
echo ========================================
echo.
echo Plugin installed to: %PLUGIN_FOLDER%
echo Manifest installed to: %REVIT_ADDINS%\Materialdex.addin
echo.
echo IMPORTANT: 
echo 1. Close Revit if it's running
echo 2. Start the Materialdex web app: npm run dev
echo 3. Launch Revit 2026
echo 4. Look for the Materialdex tab in the ribbon
echo.
pause


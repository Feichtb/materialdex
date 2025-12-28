@echo off
REM Materialdex Revit Plugin Installer
REM This script installs the Materialdex.bundle to the Autodesk ApplicationPlugins folder

echo ========================================
echo Materialdex Revit Plugin Installer
echo ========================================
echo.

REM Check if running as administrator
net session >nul 2>&1
if errorlevel 1 goto :peruser
echo Running with administrator privileges...
set "INSTALL_DIR=%ProgramData%\Autodesk\ApplicationPlugins"
set "INSTALL_TYPE=Per Machine"
goto :continue
:peruser
echo Running as standard user (per-user installation)...
set "INSTALL_DIR=%AppData%\Autodesk\ApplicationPlugins"
set "INSTALL_TYPE=Per User"
:continue

echo.
echo Installation Type: %INSTALL_TYPE%
echo Target Directory: %INSTALL_DIR%
echo.

REM Check if bundle folder exists
if not exist "Materialdex.bundle" (
    echo ERROR: Materialdex.bundle folder not found!
    echo Please run this script from the RevitPlugin directory.
    pause
    exit /b 1
)

REM Create target directory if it doesn't exist
if not exist "%INSTALL_DIR%" (
    echo Creating directory: %INSTALL_DIR%
    mkdir "%INSTALL_DIR%"
)

REM Remove existing installation if present
if exist "%INSTALL_DIR%\Materialdex.bundle" (
    echo Removing existing installation...
    rmdir /s /q "%INSTALL_DIR%\Materialdex.bundle"
)

REM Copy bundle to installation directory
echo Copying Materialdex.bundle...
xcopy /E /I /Y "Materialdex.bundle" "%INSTALL_DIR%\Materialdex.bundle"

if errorlevel 1 goto :installfailed
echo.
echo ========================================
echo Installation completed successfully!
echo ========================================
echo.
echo The Materialdex plugin has been installed to:
echo %INSTALL_DIR%\Materialdex.bundle
echo.
echo Please restart Revit 2026 to load the plugin.
echo Look for the "Materialdex" tab in the Revit ribbon.
echo.
goto :end
:installfailed
echo.
echo ========================================
echo Installation failed!
echo ========================================
echo.
echo Please check the error messages above.
echo You may need to run this script as Administrator.
echo.
:end

pause


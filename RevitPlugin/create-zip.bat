@echo off
setlocal enabledelayedexpansion
REM Create ZIP file for GitHub Releases

echo ========================================
echo Creating ZIP package for release
echo ========================================
echo.

REM Check if bundle exists
if not exist "Materialdex.bundle" (
    echo ERROR: Materialdex.bundle folder not found!
    echo Please run package-for-store.bat first.
    pause
    exit /b 1
)

REM Update this when bumping the release version
set VERSION=2.0.0

set ZIPFILE=Materialdex-%VERSION%.zip

echo Version: %VERSION%
echo Creating: %ZIPFILE%
echo.

REM Remove existing ZIP if present
if exist "%ZIPFILE%" (
    echo Removing existing ZIP file...
    del "%ZIPFILE%"
)

REM Create ZIP using PowerShell
powershell -Command "Compress-Archive -Path 'Materialdex.bundle' -DestinationPath '%ZIPFILE%' -Force"

if %errorLevel% == 0 (
    echo.
    echo ========================================
    echo ZIP file created successfully!
    echo ========================================
    echo.
    echo File: %ZIPFILE%
    echo Size:
    dir "%ZIPFILE%" | findstr "%ZIPFILE%"
    echo.
    echo Ready to attach to GitHub release!
    echo.
) else (
    echo.
    echo ERROR: Failed to create ZIP file!
    echo.
)

pause


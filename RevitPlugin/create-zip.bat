@echo off
setlocal enabledelayedexpansion
REM Create ZIP file for Autodesk App Store submission

echo ========================================
echo Creating ZIP package for App Store
echo ========================================
echo.

REM Check if bundle exists
if not exist "Materialdex.bundle" (
    echo ERROR: Materialdex.bundle folder not found!
    echo Please run package-for-store.bat first.
    pause
    exit /b 1
)

REM Use version 1.0.0 (can be updated manually if needed)
set VERSION=1.0.0

set ZIPFILE=Materialdex-v%VERSION%.zip

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
    echo Ready for Autodesk App Store submission!
    echo.
) else (
    echo.
    echo ERROR: Failed to create ZIP file!
    echo.
)

pause


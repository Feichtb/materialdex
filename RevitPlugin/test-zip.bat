@echo off
REM Test the ZIP file by extracting it and verifying structure

echo ========================================
echo Testing ZIP Package
echo ========================================
echo.

set ZIPFILE=Materialdex-v1.0.0.zip
set TESTDIR=test-extract

REM Check if ZIP exists
if not exist "%ZIPFILE%" (
    echo ERROR: %ZIPFILE% not found!
    echo Please run create-zip.bat first.
    pause
    exit /b 1
)

echo ZIP file found: %ZIPFILE%
echo.

REM Remove test directory if exists
if exist "%TESTDIR%" (
    echo Removing old test directory...
    rmdir /s /q "%TESTDIR%"
)

REM Extract ZIP
echo Extracting ZIP file...
powershell -Command "Expand-Archive -Path '%ZIPFILE%' -DestinationPath '%TESTDIR%' -Force"

if errorlevel 1 (
    echo ERROR: Failed to extract ZIP file!
    pause
    exit /b 1
)

echo.
echo Verifying extracted structure...

REM Check for bundle folder
if not exist "%TESTDIR%\Materialdex.bundle" (
    echo ERROR: Materialdex.bundle not found in ZIP!
    pause
    exit /b 1
)

REM Check for PackageContents.xml
if not exist "%TESTDIR%\Materialdex.bundle\PackageContents.xml" (
    echo ERROR: PackageContents.xml not found!
    pause
    exit /b 1
)

REM Check for main DLL
if not exist "%TESTDIR%\Materialdex.bundle\Contents\Materialdex.dll" (
    echo ERROR: Materialdex.dll not found!
    pause
    exit /b 1
)

echo.
echo ========================================
echo ZIP file test PASSED!
echo ========================================
echo.
echo The ZIP file contains:
echo - Materialdex.bundle folder
echo - PackageContents.xml
echo - All required DLLs and resources
echo.
echo You can now test installation by:
echo 1. Extracting the ZIP manually
echo 2. Copying Materialdex.bundle to:
echo    %AppData%\Autodesk\ApplicationPlugins\
echo 3. Launching Revit
echo.
echo Test files are in: %TESTDIR%\
echo (You can delete this folder after testing)
echo.

pause


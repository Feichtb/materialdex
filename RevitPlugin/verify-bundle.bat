@echo off
REM Verify the Materialdex bundle package structure

echo ========================================
echo Materialdex Bundle Verification
echo ========================================
echo.

set ERRORS=0

REM Check if bundle exists
if not exist "Materialdex.bundle" (
    echo [ERROR] Materialdex.bundle folder not found!
    set /a ERRORS+=1
    goto :end
)

echo [OK] Bundle folder exists
echo.

REM Check PackageContents.xml
if not exist "Materialdex.bundle\PackageContents.xml" (
    echo [ERROR] PackageContents.xml not found!
    set /a ERRORS+=1
) else (
    echo [OK] PackageContents.xml found
)

REM Check Contents folder
if not exist "Materialdex.bundle\Contents" (
    echo [ERROR] Contents folder not found!
    set /a ERRORS+=1
) else (
    echo [OK] Contents folder exists
)

REM Check main DLL
if not exist "Materialdex.bundle\Contents\Materialdex.dll" (
    echo [ERROR] Materialdex.dll not found!
    set /a ERRORS+=1
) else (
    echo [OK] Materialdex.dll found
)

REM Check WebView2 dependency (required for dockable pane)
if not exist "Materialdex.bundle\Contents\Microsoft.Web.WebView2.Wpf.dll" (
    echo [ERROR] WebView2 WPF DLL not found!
    set /a ERRORS+=1
) else (
    echo [OK] WebView2 dependencies found
)

REM Check resources
if not exist "Materialdex.bundle\Contents\Resources\materialdex-32.png" (
    echo [ERROR] Icons not found!
    set /a ERRORS+=1
) else (
    echo [OK] Icons found
)

REM Check documentation
if not exist "Materialdex.bundle\Contents\Help.html" (
    echo [WARNING] Help.html not found
) else (
    echo [OK] Help.html found
)

if not exist "Materialdex.bundle\Contents\License.txt" (
    echo [WARNING] License.txt not found
) else (
    echo [OK] License.txt found
)

REM Check runtimes
if not exist "Materialdex.bundle\Contents\runtimes\win-x64\native\WebView2Loader.dll" (
    echo [WARNING] WebView2 runtimes not found
) else (
    echo [OK] WebView2 runtimes found
)

REM Check for PDB files (should not be included)
dir /s /b "Materialdex.bundle\Contents\*.pdb" >nul 2>&1
if %errorLevel% == 0 (
    echo [WARNING] PDB files found - these should be excluded from release
) else (
    echo [OK] No PDB files found
)

echo.
echo ========================================
if %ERRORS% == 0 (
    echo Bundle verification PASSED!
    echo.
    echo Bundle is ready for:
    echo - Local testing (use install-bundle.bat)
    echo - App Store submission (use create-zip.bat)
) else (
    echo Bundle verification FAILED!
    echo Found %ERRORS% error(s)
    echo.
    echo Please fix the errors before submission.
)
echo ========================================
echo.

pause


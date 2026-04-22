@echo off
echo Installing Materialdex Revit Plugin...

set REVIT_ADDINS=%APPDATA%\Autodesk\Revit\Addins\2026
set PLUGIN_FOLDER=%REVIT_ADDINS%\Materialdex

echo Creating plugin folder: %PLUGIN_FOLDER%
if not exist "%PLUGIN_FOLDER%" mkdir "%PLUGIN_FOLDER%"

echo Copying plugin files...
xcopy /Y /E /I "bin\Release\*.*" "%PLUGIN_FOLDER%\"

echo Copying .addin manifest...
copy /Y "Materialdex.addin" "%REVIT_ADDINS%\"

echo Installation complete!
echo Plugin installed to: %PLUGIN_FOLDER%
echo .addin file installed to: %REVIT_ADDINS%
echo.
echo IMPORTANT: Close and restart Revit for changes to take effect!
pause



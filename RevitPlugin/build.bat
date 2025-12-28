@echo off
echo Building Materialdex Revit Plugin...
dotnet build Materialdex.csproj -c Release
if %ERRORLEVEL% NEQ 0 (
    echo Build failed!
    pause
    exit /b %ERRORLEVEL%
)
echo Build successful!
pause

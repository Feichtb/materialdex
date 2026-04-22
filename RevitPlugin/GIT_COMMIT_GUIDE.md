# Git Commit Guide for Materialdex

This outlines which files are committed to GitHub and which are excluded.

## Files to Commit (Source Code)

### RevitPlugin/

- `App.cs`, `MaterialExtractor.cs`, `MaterialdexDockablePane.xaml`, `MaterialdexDockablePane.xaml.cs`
- `Materialdex.csproj`, `Materialdex.sln`, `Materialdex.addin`
- `PackageContents.xml`, `Help.html`, `License.txt`
- `Resources/` — icons
- `build.bat`, `install.bat`, `install-bundle.bat`, `package-for-store.bat`, `create-zip.bat`, `verify-bundle.bat`, `test-zip.bat`
- `README.md`, `BUNDLE_README.md`, `INSTALLATION_INSTRUCTIONS.md`, `CONFIGURE_URL.md`, `PRE_SUBMISSION_CHECKLIST.md`, `GIT_COMMIT_GUIDE.md`

### Root

- `src/` — Next.js web app source
- `marketing-site/` — landing page
- `package.json`, `package-lock.json`, config files
- `README.md`, `QUICK_START.md`, `CLAUDE.md`
- `netlify.toml`, `next.config.js`, `tailwind.config.js`, `tsconfig.json`

## Files NOT to Commit (gitignored)

| Category | Excluded |
|----------|---------|
| Build output | `RevitPlugin/bin/`, `RevitPlugin/obj/` |
| Generated package | `RevitPlugin/Materialdex.bundle/` |
| Release ZIPs | `RevitPlugin/*.zip` |
| Code signing cert | `*.pfx` |
| API keys | `.env`, `.env*.local` |
| JS artifacts | `node_modules/`, `.next/` |
| Internal eval | `eval/` |
| Old screenshots | `store screenshots/` |

## Regenerating the Package

After cloning, rebuild the release package:

```cmd
cd RevitPlugin
build.bat
package-for-store.bat
create-zip.bat
```

This produces `Materialdex.bundle/` and the release ZIP from source.

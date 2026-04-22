# Pre-Release Checklist

Use this before packaging and publishing a new GitHub release.

---

## 1. What Goes in the Release ZIP

When you run `package-for-store.bat` then `create-zip.bat`, the following ends up in `Materialdex-v{VERSION}.zip`:

| Source | In ZIP (Materialdex.bundle) |
|--------|-----------------------------|
| **PackageContents.xml** | `Materialdex.bundle/PackageContents.xml` |
| **bin/Release/** (all DLLs, no .pdb) | `Materialdex.bundle/Contents/` |
| **Materialdex.addin** | `Materialdex.bundle/Contents/Materialdex.addin` |
| **Resources/** (icons) | `Materialdex.bundle/Contents/Resources/` |
| **Help.html, License.txt** | `Materialdex.bundle/Contents/` |

The ZIP contains everything a user needs. They extract it and copy `Materialdex.bundle` to their Autodesk ApplicationPlugins folder.

---

## 2. What Goes to GitHub (Source)

Committed to the repo:

- **RevitPlugin/** — All source (`.cs`, `.xaml`, `.csproj`, `.sln`, `.addin`)
- **RevitPlugin/Resources/** — Icons
- **RevitPlugin/PackageContents.xml**
- **RevitPlugin/** scripts — `build.bat`, `package-for-store.bat`, `create-zip.bat`, `install.bat`, `install-bundle.bat`, `verify-bundle.bat`
- **RevitPlugin/** docs — `README.md`, `INSTALLATION_INSTRUCTIONS.md`, `BUNDLE_README.md`, `CONFIGURE_URL.md`, this file
- **Root** — `src/`, `marketing-site/`, `package.json`, config files, `README.md`

Not committed (in .gitignore):

- `RevitPlugin/bin/`, `RevitPlugin/obj/` — build output
- `RevitPlugin/Materialdex.bundle/` — generated package
- `RevitPlugin/*.zip` — generated release ZIPs
- `*.pfx` — code signing certificate
- `.env*.local`, `.env` — API keys
- `node_modules/`, `.next/` — JS build artifacts
- `eval/` — internal eval tooling
- `store screenshots/` — outdated App Store screenshots

---

## 3. Pre-Release Checklist

### Version

- [ ] `Materialdex.csproj` — `Version`, `AssemblyVersion`, `FileVersion` all match the release version (e.g. `2.0.0`)
- [ ] `PackageContents.xml` — `ProductCode` version matches
- [ ] `create-zip.bat` — `set VERSION=2.0.0` matches
- [ ] Git tag created: `git tag v2.0.0`

### Code

- [ ] Plugin builds cleanly in Release mode: `dotnet build Materialdex.csproj -c Release`
- [ ] Production URL is set in `MaterialdexDockablePane.xaml.cs` (`USE_PRODUCTION = true`, correct Netlify URL)
- [ ] Tested in Revit 2025 or 2026 on a real model — materials extract, scans complete

### Package

- [ ] Bundle created and verified: `package-for-store.bat` then `verify-bundle.bat`
- [ ] No `.pdb` files in the bundle
- [ ] ZIP created: `create-zip.bat`
- [ ] ZIP installs correctly when manually copied to `%AppData%\Autodesk\ApplicationPlugins\`

### Secrets

- [ ] No API keys or `.env` files staged for commit
- [ ] `.pfx` not committed

### GitHub

- [ ] `README.md` reflects the current version and download link
- [ ] All changed files committed and pushed
- [ ] Release created on GitHub with the ZIP attached and release notes

---

## 4. Quick Commands

**Build and package:**

```cmd
cd RevitPlugin
build.bat
package-for-store.bat
verify-bundle.bat
create-zip.bat
```

**Git status before push:**

```cmd
git status
```

You should not see `Materialdex.bundle/`, `*.zip`, or `*.pfx` as staged files.

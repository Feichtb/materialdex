# Removing Large File from Git History

The Revit file `251222 Nicks Bend.rvt` (227.96 MB) is still in Git history and needs to be completely removed.

## Option 1: Use BFG Repo-Cleaner (Recommended)

1. Download BFG from: https://rtyley.github.io/bfg-repo-cleaner/
2. Run:
   ```bash
   java -jar bfg.jar --delete-files "251222 Nicks Bend.rvt"
   git reflog expire --expire=now --all
   git gc --prune=now --aggressive
   ```

## Option 2: Start Fresh (Simplest for New Repo)

Since this is a new repository, you can start fresh:

```bash
# Remove the remote
git remote remove origin

# Create a new orphan branch (no history)
git checkout --orphan clean-main

# Add all files except the .rvt file
git add .
git commit -m "Initial commit: Clean repository"

# Force push to GitHub (this will overwrite the old history)
git remote add origin https://github.com/Feichtb/materialdex.git
git push -f origin clean-main:main
```

## Option 3: Manual Commit Rewrite

```bash
# Reset to before the problematic commit
git reset --soft c8c3aa3^
# Remove the file
git reset "251222 Nicks Bend.rvt"
# Recommit
git commit -m "Initial commit: Ready for deployment (without large files)"
# Force push
git push -f origin main
```


## RepoLens v1.0.0

A fast, modern desktop application for viewing and organizing local Git repositories on macOS, Windows, and Linux. Built with **Tauri v2**, **React 19**, **TypeScript**, and **Rust**.

### 📦 Windows Downloads
- **Windows NSIS Setup Installer (.exe)**: [`RepoLens_1.0.0_x64-setup.exe`](https://github.com/femboypuppy/repolens/releases/download/v1.0.0/RepoLens_1.0.0_x64-setup.exe)
- **Windows MSI Installer (.msi)**: [`RepoLens_1.0.0_x64_en-US.msi`](https://github.com/femboypuppy/repolens/releases/download/v1.0.0/RepoLens_1.0.0_x64_en-US.msi)

> **Code Signing Notice**: Releases are open-source builds provided directly without commercial enterprise signing certificates.
> - **Windows**: Windows SmartScreen may show *"Windows protected your PC"*. Click **More info** -> **Run anyway**.
> - **macOS**: On first launch, right-click the app and choose **Open**, or run: `xattr -cr /Applications/RepoLens.app`.

---

### 🚀 Key Features

1. **Branch Compare & PR Preview View (`git diff A...B`)**:
   - Compare any two branches or revisions with base/compare selectors and quick-swap.
   - Ahead/behind commit counts and commit list.
   - Cumulative file diff inspection with syntax highlighting and addition/deletion counters.

2. **Interactive File History & Blame Heatmap**:
   - Line-by-line `git blame` with color-coded age warmth (recent commits glow green/teal, older commits in neutral tones).
   - Author, date, commit hash, and commit subject metadata for every line.
   - Chronological revision history of changes to any repository file.

3. **Visual Commit Graph**:
   - Interactive SVG commit graph with branch chips, merge indicators, and parent links.
   - Click-to-diff inspection for any commit in the repository history.

4. **"What Did I Do?" Daily Activity Summary**:
   - Cross-repository timeline grouped by day showing all your local commits.
   - One-click **"Copy as Markdown"** formatted specifically for standup and status reports.

5. **Multi-Repository Code Search**:
   - Fast `git grep` execution across all configured repository folders.
   - Regex patterns, case-sensitivity toggles, and per-repository match breakdowns.

6. **Unpushed Work Radar & Live Filesystem Watcher**:
   - Real-time notification banner highlighting repositories with unpushed local commits.
   - Low-overhead native filesystem event watcher automatically updates repository state on changes.

7. **Branches, Tags, Stashes & Worktrees Browser**:
   - Comprehensive segmented reference viewer for local/remote branches, stashes, and Git worktrees.

8. **System Tray & Command Palette**:
   - Native system tray quick menu with repository counts and alert badges.
   - Universal command palette (<kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd>) for instant navigation.

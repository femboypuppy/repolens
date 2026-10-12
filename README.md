# RepoLens

RepoLens is a fast, polished desktop application for discovering, organizing, and exploring local Git repositories on macOS, Windows, and Linux. Built with Tauri v2, React 19, TypeScript, Tailwind CSS, Motion for React, and Rust.

RepoLens operates completely locally and read-only: it connects directly to your installed `git` executable with safe argument arrays, without running background HTTP servers or requiring cloud accounts.

---

## Key Features

### 1. Visual Commit Graph & Interactive Diff Inspection
- **Topological Commit Graph**: SVG curve rendering with branching and merge lanes, commit badges, and branch/tag pointers.
- **Click-to-Diff Inspection**: Clicking any commit in the graph opens a comprehensive commit detail pane showing the commit author, relative/absolute timestamp, GPG/parent links, commit message, and per-file diffs.
- **Branch Filtering**: Toggle between commits on the current branch or `--all` branches across history.

### 2. "What Did I Do?" Cross-Repo Activity Summary
- **Chronological Standup Timeline**: Aggregates your commits across all discovered repositories into daily buckets (Today, Yesterday, Last 7 Days, Last 30 Days).
- **One-Click Standup Markdown**: Single click copies a clean, bulleted Markdown summary of your commits grouped by repository — perfect for daily standups, weekly reports, or timesheets.
- **Author Filtering**: Automatically defaults to your configured Git `user.name` or `user.email`, with a quick switch to show all team authors.

### 3. Multi-Repo Code Search (`git grep`)
- **Fast Subprocess Grep**: High-performance regex or literal string search across all configured repositories simultaneously.
- **Regex & Case-Sensitivity Toggles**: Full regular expression support with live match counts per repository and file path.
- **Jump to Location**: One-click to copy matched file path or open in OS file manager.

### 4. Side-by-Side & Unified Diffs with Syntax Highlighting
- **Dual Diff Views**: Toggle between unified diff and side-by-side side-by-column diff modes.
- **Safe Syntax Highlighting**: Colorizes diff chunks using `lowlight` (highlight.js engine) mapped directly to React elements without `dangerouslySetInnerHTML`.
- **Large Diff Safeguards**: Automatically warns and truncates giant files (>3,000 lines or >400 chars/line) and flags binary assets.

### 5. Unpushed Work Radar
- **Ahead/Unpushed Commit Detection**: Live banner highlights all repositories with commits that have not been pushed to their remote upstream or have no tracking remote.
- **One-Click Jump**: Click any repository badge in the radar to jump directly to it and inspect unpushed commits.

### 6. Live Filesystem Auto-Refresh
- **Low-Overhead Native Watcher**: Powered by Rust's `notify` 8 crate, RepoLens monitors `.git/HEAD`, `.git/index`, and working directories.
- **Debounced Updates**: Silently auto-refreshes repository status within 600ms of any external commit, branch switch, or file change without manual reloading.
- **Configurable**: Easily toggle live auto-refresh on or off in Settings.

### 7. Branches, Tags, Stashes & Worktrees
- **Segmented Reference Explorer**: Detailed inspection tabs for local branches, remote tracking branches, annotated/lightweight tags, Git stashes (with stash diff preview), and linked Git worktrees.

### 8. Custom Color Tags & Sidebar Organization
- **Custom Tagging**: Tag repositories with custom labels (e.g. `Work`, `Personal`, `Open Source`, `Infra`) with 7 vibrant colors.
- **Sidebar Filtering**: Filter your workspace instantly by tag, favorites, or repositories with uncommitted changes.

### 9. Native System Tray Quick Menu
- **System Tray Icon**: Native tray integration showing repository status, uncommitted change counts, and quick show/hide actions.
- **Right-Click Menu**: Quick access to recent repositories, refresh, and settings.

### 10. Fleet Overview & Universal Command Palette
- **Multi-Repo Fleet Table**: High-density tabular view displaying all repositories side-by-side with ahead/behind status, uncommitted file breakdown, and one-click IDE launch (VS Code, Cursor, Terminal, Explorer/Finder).
- **Universal Command Palette (<kbd>Ctrl+K</kbd> / <kbd>Cmd+K</kbd>)**: Keyboard-first fuzzy search across all repositories, views, and settings actions.

### 11. Refined Platform Visuals & macOS Liquid Glass
- **Platform-Native Styling**: System appearance by default, with manual light and dark theme toggles.
- **macOS Translucency**: Liquid Glass-inspired translucent sidebar and title bar overlay with native window control padding.
- **Windows & Linux**: Clean, distraction-free opaque surfaces with subtle borders and native window behaviors.
- **Browser-Only Demo Mode**: Instant preview with realistic mock repositories, commits, and diffs without requiring Tauri or Git installed.

---

## Architecture

RepoLens follows a clean desktop architecture separating the high-performance Rust backend from the reactive TypeScript/React user interface:

```
├── src/                          # Frontend React 19 + TypeScript application
│   ├── components/               # Desktop UI components
│   │   ├── detail/               # Repository detail pane components
│   │   │   ├── CommitGraph.tsx   # SVG commit graph lane layout & rendering
│   │   │   ├── CommitDetail.tsx  # Expanded commit inspector with file diffs
│   │   │   ├── CommitsTab.tsx    # Commits history with graph & branch filters
│   │   │   ├── RefsTab.tsx       # Branches, tags, stashes, and worktrees
│   │   │   ├── ChangesTab.tsx    # Working tree changes grouped by status
│   │   │   └── OverviewTab.tsx   # Quick health, custom tags, and launchers
│   │   ├── ActivityView.tsx      # "What Did I Do?" cross-repo standup timeline
│   │   ├── SearchView.tsx        # Multi-repo regex code search (git grep)
│   │   ├── UnpushedBanner.tsx    # Unpushed-work radar banner
│   │   ├── DetailPane.tsx        # Resizable tabbed detail container
│   │   ├── DiffViewer.tsx        # Unified & side-by-side syntax diff viewer
│   │   ├── FleetOverview.tsx     # High-density multi-repo tabular audit
│   │   ├── HeaderToolbar.tsx     # View switcher, search, sort, and refresh
│   │   ├── Sidebar.tsx           # Workspaces, filters, tags, and theme toggle
│   │   ├── RepositoryList.tsx    # Compact repo list with star animations
│   │   ├── CommandPalette.tsx    # Universal Ctrl+K fuzzy launcher
│   │   ├── SettingsModal.tsx     # User preferences & keyboard shortcuts
│   │   └── FirstRunView.tsx      # Welcome screen and onboarding actions
│   ├── demo/                     # Mock repositories and realistic diff text
│   ├── services/                 # Tauri commands bridge with browser fallback
│   ├── types/                    # Shared TypeScript interfaces
│   └── utils/                    # Graph layout, syntax highlighter, time formatters
└── src-tauri/                    # Rust Backend (Tauri v2)
    ├── src/
    │   ├── commands.rs           # 22 typed Tauri command handlers
    │   ├── git.rs                # Read-only Git subprocess operations & parsers
    │   ├── models.rs             # Serializable models matching frontend types
    │   ├── scanner.rs            # Recursive discovery with cycle checks & deduplication
    │   ├── storage.rs            # OS-specific application data directory persistence
    │   ├── watcher.rs            # Native filesystem watcher (notify crate)
    │   └── tray.rs               # Native system tray menu integration
    ├── capabilities/             # Tauri v2 scoped security capability permissions
    └── tests/                    # Integration tests with real temporary Git repositories
```

### Security & Safety

- **Strictly Read-Only Git**: All operations execute read-only queries (`status`, `log`, `branch`, `diff`, `rev-parse`, `remote`, `tag`, `stash`, `worktree`, `grep`). RepoLens never commits, checks out, resets, merges, fetches, pushes, or deletes code.
- **Sandboxed Subprocess Environment**: Git subprocesses enforce `GIT_OPTIONAL_LOCKS=0`, `GIT_TERMINAL_PROMPT=0`, `LC_ALL=C`, and `GIT_PAGER=cat` to prevent hanging on credentials, blocking index locks, or pagination traps.
- **Strict Tauri v2 Capabilities**: Every backend command is explicitly declared in `build.rs` and bound via individual `allow-*` permissions in `src-tauri/capabilities/default.json`. Unscoped arbitrary shell execution is disallowed.
- **Path Confinement & Canonicalization**: All user paths are canonicalized via `dunce::canonicalize` to prevent symlink traversal attacks, resolve Windows 8.3 short paths, and ensure diff queries stay within user-configured workspace directories.
- **Safe XSS-Free Highlighting**: Syntax highlighting generates React AST nodes via `lowlight` directly, never using `dangerouslySetInnerHTML`.

---

## Prerequisites

- **Node.js**: `v20.x` or `v22.x`
- **Rust**: `1.80+` with Cargo
- **Git**: Installed and available in your system `PATH`
- **Platform Build Tools**:
  - **Windows**: Microsoft Visual Studio C++ Build Tools and WebView2 (preinstalled on Windows 10/11)
  - **macOS**: Xcode Command Line Tools (`xcode-select --install`)
  - **Linux**: WebKit2GTK and dependencies (`libwebkit2gtk-4.1-dev`, `libayatana-appindicator3-dev`, `librsvg2-dev`, `patchelf`, `libssl-dev`, `libxdo-dev`)

---

## Commands

### Development

```bash
# Install npm dependencies
npm install

# Run desktop application in Tauri development mode
npm run dev

# Run browser-only demo mode (instant preview without Tauri or local Git)
npm run dev:browser

# Open browser demo mode directly in default browser
npm run demo
```

### Verification & Testing

```bash
# Check TypeScript types without emitting code
npm run typecheck

# Run ESLint across frontend TypeScript/React source
npm run lint

# Run Vitest frontend test suite
npm test

# Run Rust unit and integration tests (uses real temporary Git repos)
npm run test:cargo

# Run all tests (both Vitest and Cargo test suites)
npm run test:all
```

### Production Build

```bash
# Build frontend web bundle into dist/
npm run build

# Build native desktop package via Tauri CLI
npm run build:tauri
```

---

## Platform Support & Desktop Conventions

| Platform | Architectures | Window Styling | Storage Path |
| :--- | :--- | :--- | :--- |
| **macOS** | Apple Silicon (`aarch64`), Intel (`x86_64`) | Liquid Glass translucency, title bar overlay, traffic light padding | `~/Library/Application Support/repolens/settings.json` |
| **Windows** | x64, ARM64 | Opaque neutral surfaces, native window controls | `%APPDATA%\repolens\settings.json` |
| **Linux** | x64, ARM64 | Desktop theme integration, opaque surfaces | `~/.local/share/repolens/settings.json` or `$XDG_DATA_HOME` |

---

## Keyboard Shortcuts

| Shortcut | Action |
| :--- | :--- |
| <kbd>Ctrl</kbd>+<kbd>K</kbd> / <kbd>⌘</kbd>+<kbd>K</kbd> | Open Universal Command Palette |
| <kbd>Ctrl</kbd>+<kbd>F</kbd> / <kbd>⌘</kbd>+<kbd>F</kbd> | Focus repository search input |
| <kbd>Ctrl</kbd>+<kbd>R</kbd> / <kbd>⌘</kbd>+<kbd>R</kbd> | Refresh and rescan repositories |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> / <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>A</kbd> | Switch to "What Did I Do?" Activity Summary |
| <kbd>Ctrl</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> / <kbd>⌘</kbd>+<kbd>Shift</kbd>+<kbd>F</kbd> | Open Multi-Repo Code Search (`git grep`) |
| <kbd>Ctrl</kbd>+<kbd>1</kbd> / <kbd>⌘</kbd>+<kbd>1</kbd> | Switch to Repository List view |
| <kbd>Ctrl</kbd>+<kbd>2</kbd> / <kbd>⌘</kbd>+<kbd>2</kbd> | Switch to Multi-Repo Fleet Overview |
| <kbd>Ctrl</kbd>+<kbd>3</kbd> / <kbd>⌘</kbd>+<kbd>3</kbd> | Switch to Activity Summary view |
| <kbd>Ctrl</kbd>+<kbd>,</kbd> / <kbd>⌘</kbd>+<kbd>,</kbd> | Open Settings modal |
| <kbd>Esc</kbd> | Dismiss active modal, clear search query, or close detail pane |

---

## Code Signing & Release Notes

RepoLens supports production desktop packaging across macOS, Windows, and Linux.

### macOS (Notarization & Gatekeeper)

Releases distributed through GitHub Actions are open-source community builds provided without an Apple Developer ID signature.

- **Gatekeeper Warning**: On first launch, macOS will report that the app cannot be opened because it is from an unidentified developer.
- **Resolution**: Right-click (or Control-click) `RepoLens.app` in Finder, choose **Open**, and click **Open** in the dialog. Alternatively, remove the quarantine attribute in Terminal:
  ```bash
  xattr -cr /Applications/RepoLens.app
  ```
- **Signing with Developer ID**: If you have an Apple Developer ID Application Certificate, configure `APPLE_CERTIFICATE`, `APPLE_ID`, and `APPLE_PASSWORD` in your build environment to generate notarized disk images.

### Windows (SmartScreen)

Unsigned Windows installers may prompt a Microsoft Defender SmartScreen notification ("Windows protected your PC").

- **Resolution**: Click **More info**, then click **Run anyway**.
- **Authenticode Signing**: To sign your Windows installers, pass your `.pfx` certificate or Azure Trusted Signing credentials to `signtool.exe`:
  ```powershell
  signtool.exe sign /f "cert.pfx" /p "password" /tr "http://timestamp.digicert.com" /td sha256 /fd sha256 "src-tauri\target\release\bundle\nsis\RepoLens_1.0.0_x64-setup.exe"
  ```

---

## Automated GitHub Releases & Workflows

RepoLens includes complete GitHub Actions workflows:

- **`.github/workflows/ci.yml`**: Runs TypeScript typecheck, ESLint, Vitest frontend tests, Cargo integration tests with real temporary Git repositories, and web distribution build across Ubuntu 22.04, macOS, and Windows.
- **`.github/workflows/package.yml`**: Manually triggered packaging workflow that builds installable native desktop artifacts (`.dmg`, `.exe`, `.AppImage`) for Apple Silicon, Intel macOS, Windows, and Linux.
- **`.github/workflows/release.yml`**: Automatically builds and publishes a GitHub Release with installer attachments when a version tag (`v*`) is pushed or triggered via the GitHub Actions UI.

---

## License

MIT © [RepoLens Contributors](LICENSE)

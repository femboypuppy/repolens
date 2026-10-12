//! Tauri command handlers.
//!
//! Git/filesystem work runs in `spawn_blocking` from async commands so it never
//! blocks the main (UI) thread. Every repository path is validated against the
//! user's configured locations before use.

use std::path::{Path, PathBuf};
use std::process::Command;

use tauri::{AppHandle, State};

use crate::git;
use crate::models::{
    AppSettings, ChangedFiles, CommitDiff, FileDiff, GitBranch, GitCommit, GitEnvironment,
    GitStash, GitTag, GitWorktree, RepositoryInfo, SearchResult, TraySummary,
};
use crate::process::hide_console;
use crate::scanner;
use crate::security::{ensure_allowed, ensure_repository, ensure_scan_root, validate_relative_path};
use crate::storage;
use crate::watcher::{self, WatchState};

async fn blocking<T, F>(f: F) -> Result<T, String>
where
    T: Send + 'static,
    F: FnOnce() -> Result<T, String> + Send + 'static,
{
    tauri::async_runtime::spawn_blocking(f)
        .await
        .map_err(|e| format!("Background task failed: {}", e))?
}

// ---------------------------------------------------------------------------
// Environment & settings
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_git_environment() -> Result<GitEnvironment, String> {
    blocking(|| Ok(git::get_git_environment())).await
}

#[tauri::command]
pub async fn load_settings() -> Result<AppSettings, String> {
    blocking(|| Ok(storage::load_settings())).await
}

#[tauri::command]
pub async fn save_settings(settings: AppSettings) -> Result<(), String> {
    blocking(move || storage::save_settings(&settings)).await
}

/// Native folder picker. Kept synchronous on purpose: native dialogs must run on
/// the main thread on macOS, and the dialog is modal anyway.
#[tauri::command]
pub fn pick_folder(title: Option<String>) -> Result<Option<String>, String> {
    let picked = rfd::FileDialog::new()
        .set_title(title.as_deref().unwrap_or("Select Folder"))
        .pick_folder();
    Ok(picked.map(|p| dunce::simplified(&p).to_string_lossy().into_owned()))
}

// ---------------------------------------------------------------------------
// Discovery
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn scan_workspace_folder(path: String, max_depth: Option<usize>) -> Result<Vec<String>, String> {
    blocking(move || {
        let root = ensure_scan_root(&path)?;
        let generation = scanner::current_generation();
        scanner::discover_repositories_cancellable(&root, max_depth.unwrap_or(3), generation)
            .map(|v| v.into_iter().map(|p| p.to_string_lossy().into_owned()).collect())
            .map_err(|_| "Scan cancelled".to_string())
    })
    .await
}

#[tauri::command]
pub fn cancel_scan() {
    scanner::cancel_scans();
}

#[tauri::command]
pub async fn inspect_repository(path: String, workspace_path: Option<String>) -> Result<RepositoryInfo, String> {
    blocking(move || {
        let repo = ensure_repository(&path)?;
        let settings = storage::load_settings();
        let id = repo.to_string_lossy().into_owned();
        let fav = settings.favorites.iter().any(|f| f == &id || f == &path);
        git::inspect_repository(&repo, workspace_path.as_deref().unwrap_or(""), fav)
    })
    .await
}

// ---------------------------------------------------------------------------
// Repository details
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn get_repository_commits(
    path: String,
    limit: Option<usize>,
    skip: Option<usize>,
    all_refs: Option<bool>,
) -> Result<Vec<GitCommit>, String> {
    blocking(move || {
        let repo = ensure_repository(&path)?;
        git::get_commits(&repo, limit.unwrap_or(50), skip.unwrap_or(0), all_refs.unwrap_or(false))
    })
    .await
}

#[tauri::command]
pub async fn get_repository_branches(path: String) -> Result<Vec<GitBranch>, String> {
    blocking(move || git::get_branches(&ensure_repository(&path)?)).await
}

#[tauri::command]
pub async fn get_repository_tags(path: String) -> Result<Vec<GitTag>, String> {
    blocking(move || git::get_tags(&ensure_repository(&path)?)).await
}

#[tauri::command]
pub async fn get_repository_stashes(path: String) -> Result<Vec<GitStash>, String> {
    blocking(move || git::get_stashes(&ensure_repository(&path)?)).await
}

#[tauri::command]
pub async fn get_repository_worktrees(path: String) -> Result<Vec<GitWorktree>, String> {
    blocking(move || git::get_worktrees(&ensure_repository(&path)?)).await
}

#[tauri::command]
pub async fn get_changed_files(path: String) -> Result<ChangedFiles, String> {
    blocking(move || git::list_changed_files(&ensure_repository(&path)?)).await
}

#[tauri::command]
pub async fn get_file_diff(
    repo_path: String,
    file_path: String,
    old_path: Option<String>,
    staged: bool,
    untracked: Option<bool>,
) -> Result<FileDiff, String> {
    blocking(move || {
        let repo = ensure_repository(&repo_path)?;
        validate_relative_path(&file_path)?;
        if let Some(o) = &old_path {
            validate_relative_path(o)?;
        }
        git::get_file_diff(&repo, &file_path, old_path.as_deref(), staged, untracked.unwrap_or(false))
    })
    .await
}

#[tauri::command]
pub async fn get_commit_diff(path: String, hash: String) -> Result<CommitDiff, String> {
    blocking(move || git::get_commit_diff(&ensure_repository(&path)?, &hash)).await
}

#[tauri::command]
pub async fn get_my_commits(path: String, days: Option<u32>) -> Result<Vec<GitCommit>, String> {
    blocking(move || git::get_my_commits(&ensure_repository(&path)?, days.unwrap_or(7))).await
}

#[tauri::command]
pub async fn search_repository(
    path: String,
    query: String,
    regex: Option<bool>,
    case_sensitive: Option<bool>,
) -> Result<SearchResult, String> {
    blocking(move || {
        let repo = ensure_repository(&path)?;
        git::search_repository(&repo, &query, regex.unwrap_or(false), case_sensitive.unwrap_or(false))
    })
    .await
}

// ---------------------------------------------------------------------------
// Live refresh & tray
// ---------------------------------------------------------------------------

#[tauri::command]
pub async fn watch_repositories(
    app: AppHandle,
    state: State<'_, WatchState>,
    paths: Vec<String>,
) -> Result<usize, String> {
    let repos: Vec<PathBuf> = paths.iter().filter_map(|p| ensure_repository(p).ok()).collect();
    watcher::watch(app, &state, repos)
}

#[tauri::command]
pub fn update_tray(app: AppHandle, summary: TraySummary) -> Result<(), String> {
    crate::tray::update(&app, &summary).map_err(|e| e.to_string())
}

// ---------------------------------------------------------------------------
// External launchers (no shell interpolation)
// ---------------------------------------------------------------------------

fn spawn_detached(mut cmd: Command, what: &str) -> Result<(), String> {
    cmd.spawn().map(|_| ()).map_err(|e| format!("Failed to open {}: {}", what, e))
}

#[tauri::command]
pub async fn open_in_file_manager(path: String) -> Result<(), String> {
    blocking(move || {
        let p = ensure_allowed(&path)?;
        let program = if cfg!(target_os = "windows") {
            "explorer"
        } else if cfg!(target_os = "macos") {
            "open"
        } else {
            "xdg-open"
        };
        let mut cmd = Command::new(program);
        cmd.arg(&p);
        spawn_detached(cmd, "file manager")
    })
    .await
}

/// Locate an executable on PATH (used to find VS Code's `code` launcher).
fn find_on_path(names: &[&str]) -> Option<PathBuf> {
    let path = std::env::var_os("PATH")?;
    std::env::split_paths(&path)
        .flat_map(|dir| names.iter().map(move |n| dir.join(n)))
        .find(|p| p.is_file())
}

#[tauri::command]
pub async fn open_in_vscode(path: String) -> Result<(), String> {
    blocking(move || {
        let p = ensure_allowed(&path)?;
        #[cfg(target_os = "macos")]
        {
            // Prefer the app bundle so it works even if `code` isn't on PATH.
            let mut cmd = Command::new("open");
            cmd.args(["-b", "com.microsoft.VSCode"]).arg(&p);
            if cmd.status().map(|s| s.success()).unwrap_or(false) {
                return Ok(());
            }
        }
        // On Windows the launcher is `code.cmd`. Rust's std escapes arguments for
        // batch files (and refuses arguments it cannot escape safely), so the
        // path is not interpreted by cmd.exe metacharacters.
        let names: &[&str] = if cfg!(windows) { &["code.cmd", "code.exe"] } else { &["code"] };
        let exe = find_on_path(names).ok_or_else(|| {
            "VS Code's `code` command was not found on PATH. In VS Code, run \"Shell Command: Install 'code' command in PATH\".".to_string()
        })?;
        let mut cmd = Command::new(exe);
        cmd.arg(&p);
        hide_console(&mut cmd);
        spawn_detached(cmd, "VS Code")
    })
    .await
}

#[cfg(target_os = "windows")]
fn launch_terminal(dir: &Path) -> Result<(), String> {
    use std::os::windows::process::CommandExt;
    const CREATE_NEW_CONSOLE: u32 = 0x0000_0010;
    let mut cmd = Command::new("powershell.exe");
    cmd.arg("-NoExit").current_dir(dir).creation_flags(CREATE_NEW_CONSOLE);
    spawn_detached(cmd, "PowerShell")
}

#[cfg(target_os = "macos")]
fn launch_terminal(dir: &Path) -> Result<(), String> {
    let mut cmd = Command::new("open");
    cmd.args(["-a", "Terminal"]).arg(dir);
    spawn_detached(cmd, "Terminal")
}

#[cfg(all(not(target_os = "windows"), not(target_os = "macos")))]
fn launch_terminal(dir: &Path) -> Result<(), String> {
    for term in ["x-terminal-emulator", "gnome-terminal", "konsole", "xfce4-terminal", "kitty", "alacritty", "xterm"] {
        let mut cmd = Command::new(term);
        cmd.current_dir(dir);
        if cmd.spawn().is_ok() {
            return Ok(());
        }
    }
    Err("No terminal emulator found".to_string())
}

#[tauri::command]
pub async fn open_in_terminal(path: String) -> Result<(), String> {
    blocking(move || {
        let p = ensure_allowed(&path)?;
        launch_terminal(&p)
    })
    .await
}

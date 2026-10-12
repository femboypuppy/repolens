const COMMANDS: &[&str] = &[
    "get_git_environment",
    "load_settings",
    "save_settings",
    "pick_folder",
    "scan_workspace_folder",
    "cancel_scan",
    "inspect_repository",
    "get_repository_commits",
    "get_repository_branches",
    "get_repository_tags",
    "get_repository_stashes",
    "get_repository_worktrees",
    "get_changed_files",
    "get_file_diff",
    "get_commit_diff",
    "get_my_commits",
    "search_repository",
    "compare_branches",
    "get_comparison_file_diff",
    "get_file_history",
    "get_file_blame",
    "watch_repositories",
    "update_tray",
    "open_in_file_manager",
    "open_in_vscode",
    "open_in_terminal",
];

fn main() {
    // Declaring an app manifest makes every app command require an explicit
    // permission in a capability file (see capabilities/default.json).
    tauri_build::try_build(
        tauri_build::Attributes::new().app_manifest(tauri_build::AppManifest::new().commands(COMMANDS)),
    )
    .expect("failed to run tauri-build");
}

pub mod commands;
pub mod git;
pub mod models;
pub mod process;
pub mod scanner;
pub mod security;
pub mod storage;
pub mod tray;
pub mod watcher;

use std::sync::Mutex;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(watcher::WatchState(Mutex::new(None)))
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            if let Err(e) = tray::create(app.handle()) {
                // A missing tray (e.g. no appindicator on Linux) must not prevent startup.
                log::warn!("Tray icon unavailable: {}", e);
            }
            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            commands::get_git_environment,
            commands::load_settings,
            commands::save_settings,
            commands::pick_folder,
            commands::scan_workspace_folder,
            commands::cancel_scan,
            commands::inspect_repository,
            commands::get_repository_commits,
            commands::get_repository_branches,
            commands::get_repository_tags,
            commands::get_repository_stashes,
            commands::get_repository_worktrees,
            commands::get_changed_files,
            commands::get_file_diff,
            commands::get_commit_diff,
            commands::get_my_commits,
            commands::search_repository,
            commands::compare_branches,
            commands::get_comparison_file_diff,
            commands::get_file_history,
            commands::get_file_blame,
            commands::watch_repositories,
            commands::update_tray,
            commands::open_in_file_manager,
            commands::open_in_vscode,
            commands::open_in_terminal,
        ])
        .run(tauri::generate_context!())
        .expect("error while running RepoLens");
}

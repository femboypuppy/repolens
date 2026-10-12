//! System tray / menu bar icon with a summary of repositories needing attention.
//!
//! On Linux a tray menu cannot be replaced after creation, so the menu is built
//! once and its contents are edited in place.

use std::sync::Mutex;

use tauri::menu::{Menu, MenuItem, PredefinedMenuItem};
use tauri::tray::TrayIconBuilder;
use tauri::{AppHandle, Emitter, Manager, Wry};

use crate::models::TraySummary;

pub const TRAY_ID: &str = "repolens-tray";
const MAX_REPO_ITEMS: usize = 8;

pub struct TrayState {
    menu: Menu<Wry>,
    changed: MenuItem<Wry>,
    unpushed: MenuItem<Wry>,
    repo_items: Mutex<Vec<MenuItem<Wry>>>,
}

/// Position in the menu where repository items are inserted (after the
/// "Show", separator, two status lines and a separator).
const REPO_INSERT_INDEX: usize = 5;

pub fn create(app: &AppHandle) -> tauri::Result<()> {
    let show = MenuItem::with_id(app, "show", "Show RepoLens", true, None::<&str>)?;
    let changed = MenuItem::with_id(app, "status-changed", "No repositories loaded", false, None::<&str>)?;
    let unpushed = MenuItem::with_id(app, "status-unpushed", "", false, None::<&str>)?;
    let quit = MenuItem::with_id(app, "quit", "Quit RepoLens", true, None::<&str>)?;
    let menu = Menu::with_items(
        app,
        &[
            &show,
            &PredefinedMenuItem::separator(app)?,
            &changed,
            &unpushed,
            &PredefinedMenuItem::separator(app)?,
            &PredefinedMenuItem::separator(app)?,
            &quit,
        ],
    )?;

    let mut builder = TrayIconBuilder::with_id(TRAY_ID)
        .tooltip("RepoLens")
        .menu(&menu)
        .show_menu_on_left_click(true)
        .on_menu_event(|app, event| {
            let id = event.id.as_ref();
            match id {
                "show" => show_main(app),
                "quit" => app.exit(0),
                _ => {
                    if let Some(repo_id) = id.strip_prefix("repo:") {
                        show_main(app);
                        let _ = app.emit("tray-select-repo", repo_id.to_string());
                    }
                }
            }
        });
    if let Some(icon) = app.default_window_icon() {
        builder = builder.icon(icon.clone());
    }
    #[cfg(target_os = "macos")]
    {
        builder = builder.icon_as_template(false);
    }
    builder.build(app)?;

    app.manage(TrayState { menu, changed, unpushed, repo_items: Mutex::new(Vec::new()) });
    Ok(())
}

fn show_main(app: &AppHandle) {
    if let Some(w) = app.get_webview_window("main") {
        let _ = w.unminimize();
        let _ = w.show();
        let _ = w.set_focus();
    }
}

pub fn update(app: &AppHandle, summary: &TraySummary) -> tauri::Result<()> {
    let Some(state) = app.try_state::<TrayState>() else { return Ok(()) };

    state.changed.set_text(match summary.changed_count {
        0 => "All repositories clean".to_string(),
        1 => "1 repository with changes".to_string(),
        n => format!("{} repositories with changes", n),
    })?;
    state.unpushed.set_text(match summary.unpushed_count {
        0 => "Nothing unpushed".to_string(),
        1 => "1 repository with unpushed commits".to_string(),
        n => format!("{} repositories with unpushed commits", n),
    })?;

    let mut items = state.repo_items.lock().unwrap_or_else(|e| e.into_inner());
    for item in items.drain(..) {
        let _ = state.menu.remove(&item);
    }
    for (i, repo) in summary.repos.iter().take(MAX_REPO_ITEMS).enumerate() {
        let label = format!("{}  ·  {} changed", repo.name, repo.changes);
        let item = MenuItem::with_id(app, format!("repo:{}", repo.id), label, true, None::<&str>)?;
        state.menu.insert(&item, REPO_INSERT_INDEX + i)?;
        items.push(item);
    }

    if let Some(tray) = app.tray_by_id(TRAY_ID) {
        let tip = if summary.changed_count == 0 {
            "RepoLens — all clean".to_string()
        } else {
            format!("RepoLens — {} with changes", summary.changed_count)
        };
        let _ = tray.set_tooltip(Some(tip));
    }
    Ok(())
}

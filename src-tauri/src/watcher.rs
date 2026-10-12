//! Live refresh: watch repositories and emit `repo-changed` events (debounced).
//!
//! macOS (FSEvents) and Windows (ReadDirectoryChangesW) support cheap recursive
//! watching, so the whole worktree is watched. On Linux, inotify needs one watch
//! per directory, which large trees (node_modules) can exhaust; there we watch
//! only the repository root and its Git metadata, and rely on refresh-on-focus
//! for deeper working-tree edits.

use std::collections::HashSet;
use std::path::{Component, Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::mpsc;
use std::sync::{Arc, Mutex};
use std::thread;
use std::time::Duration;

use notify::{RecommendedWatcher, RecursiveMode, Watcher};
use tauri::{AppHandle, Emitter};

use crate::scanner::should_skip_directory;

pub struct WatchState(pub Mutex<Option<WatchHandle>>);

pub struct WatchHandle {
    _watcher: RecommendedWatcher,
    stop: Arc<AtomicBool>,
}

impl Drop for WatchHandle {
    fn drop(&mut self) {
        self.stop.store(true, Ordering::SeqCst);
    }
}

/// Decide whether a filesystem event path should trigger a refresh of `repo`.
pub fn is_relevant_change(repo: &Path, path: &Path) -> bool {
    let Ok(rel) = path.strip_prefix(repo) else { return false };
    let comps: Vec<String> = rel
        .components()
        .filter_map(|c| match c {
            Component::Normal(s) => Some(s.to_string_lossy().into_owned()),
            _ => None,
        })
        .collect();
    if comps.is_empty() {
        return true;
    }
    if comps[0] == ".git" {
        // Inside Git metadata only a few files reflect user-visible state.
        let Some(second) = comps.get(1) else { return true };
        if second.ends_with(".lock") {
            return false;
        }
        return matches!(
            second.as_str(),
            "HEAD" | "index" | "refs" | "packed-refs" | "MERGE_HEAD" | "REBASE_HEAD" | "CHERRY_PICK_HEAD"
        );
    }
    !comps.iter().any(|c| should_skip_directory(c))
}

fn repo_for_path<'a>(repos: &'a [PathBuf], path: &Path) -> Option<&'a PathBuf> {
    // `repos` is sorted longest-first so nested repos win.
    repos.iter().find(|r| path.starts_with(r))
}

pub fn watch(app: AppHandle, state: &WatchState, mut repos: Vec<PathBuf>) -> Result<usize, String> {
    // Drop the previous watcher first.
    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = None;
    if repos.is_empty() {
        return Ok(0);
    }
    repos.sort_by_key(|r| std::cmp::Reverse(r.as_os_str().len()));
    repos.dedup();

    let (tx, rx) = mpsc::channel::<PathBuf>();
    let mut watcher = notify::recommended_watcher(move |res: notify::Result<notify::Event>| {
        if let Ok(event) = res {
            for p in event.paths {
                let _ = tx.send(p);
            }
        }
    })
    .map_err(|e| format!("Live refresh unavailable: {}", e))?;

    let mut watched = 0usize;
    for repo in &repos {
        let ok = if cfg!(target_os = "linux") {
            let mut ok = watcher.watch(repo, RecursiveMode::NonRecursive).is_ok();
            let git = repo.join(".git");
            if git.is_dir() {
                ok &= watcher.watch(&git, RecursiveMode::NonRecursive).is_ok();
                let heads = git.join("refs").join("heads");
                if heads.is_dir() {
                    let _ = watcher.watch(&heads, RecursiveMode::Recursive);
                }
            }
            ok
        } else {
            watcher.watch(repo, RecursiveMode::Recursive).is_ok()
        };
        if ok {
            watched += 1;
        } else {
            log::warn!("Could not watch {}", repo.display());
        }
    }

    let stop = Arc::new(AtomicBool::new(false));
    let stop_flag = stop.clone();
    let repos_for_thread = repos.clone();
    thread::spawn(move || {
        let mut pending: HashSet<PathBuf> = HashSet::new();
        loop {
            if stop_flag.load(Ordering::SeqCst) {
                break;
            }
            match rx.recv_timeout(Duration::from_millis(400)) {
                Ok(p) => {
                    if let Some(repo) = repo_for_path(&repos_for_thread, &p).filter(|r| is_relevant_change(r, &p)) {
                        pending.insert(repo.clone());
                    }
                    continue; // keep collecting until the burst settles
                }
                Err(mpsc::RecvTimeoutError::Timeout) => {}
                Err(mpsc::RecvTimeoutError::Disconnected) => break,
            }
            if !pending.is_empty() {
                let paths: Vec<String> = pending.drain().map(|p| p.to_string_lossy().into_owned()).collect();
                let _ = app.emit("repo-changed", paths);
            }
        }
    });

    *state.0.lock().unwrap_or_else(|e| e.into_inner()) = Some(WatchHandle { _watcher: watcher, stop });
    Ok(watched)
}

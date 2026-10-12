use std::collections::HashSet;
use std::fs;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};

/// Incremented to cancel any in-flight scans.
static SCAN_GENERATION: AtomicU64 = AtomicU64::new(0);

pub fn current_generation() -> u64 {
    SCAN_GENERATION.load(Ordering::SeqCst)
}

pub fn cancel_scans() {
    SCAN_GENERATION.fetch_add(1, Ordering::SeqCst);
}

#[derive(Debug, PartialEq, Eq)]
pub struct Cancelled;

/// A directory is a Git repository if it contains a `.git` directory, or a
/// `.git` file pointing elsewhere (worktrees and submodules).
pub fn is_git_repository(dir: &Path) -> bool {
    let git = dir.join(".git");
    match fs::symlink_metadata(&git) {
        Ok(m) if m.is_dir() => git.join("HEAD").exists(),
        Ok(m) if m.is_file() => fs::read_to_string(&git)
            .map(|c| c.trim_start().starts_with("gitdir:"))
            .unwrap_or(false),
        _ => false,
    }
}

/// Dependency, build, cache and VCS directories that are never traversed.
pub fn should_skip_directory(name: &str) -> bool {
    matches!(
        name,
        "node_modules" | "bower_components" | "target" | ".git" | ".hg" | ".svn"
            | ".venv" | "venv" | "__pycache__" | ".tox" | ".mypy_cache" | ".pytest_cache"
            | "dist" | "build" | "out" | ".next" | ".nuxt" | ".svelte-kit" | ".turbo"
            | ".parcel-cache" | ".gradle" | ".dart_tool" | "vendor" | "Pods" | "DerivedData"
            | ".cache" | "coverage" | ".idea" | ".vscode" | "bin" | "obj"
    )
}

/// Discover repositories up to `max_depth` levels below `root`.
pub fn discover_repositories(root: &Path, max_depth: usize) -> Vec<PathBuf> {
    discover_repositories_cancellable(root, max_depth, current_generation()).unwrap_or_default()
}

/// Like [`discover_repositories`], but aborts if [`cancel_scans`] is called.
pub fn discover_repositories_cancellable(
    root: &Path,
    max_depth: usize,
    generation: u64,
) -> Result<Vec<PathBuf>, Cancelled> {
    let mut discovered = Vec::new();
    let mut visited = HashSet::new();
    let canonical_root = match dunce::canonicalize(root) {
        Ok(p) => p,
        Err(_) => return Ok(discovered),
    };
    visited.insert(canonical_root.clone());
    if is_git_repository(&canonical_root) {
        discovered.push(canonical_root);
        return Ok(discovered);
    }
    scan(&canonical_root, 1, max_depth.clamp(1, 6), generation, &mut visited, &mut discovered)?;
    discovered.sort();
    discovered.dedup();
    Ok(discovered)
}

fn scan(
    dir: &Path,
    depth: usize,
    max_depth: usize,
    generation: u64,
    visited: &mut HashSet<PathBuf>,
    discovered: &mut Vec<PathBuf>,
) -> Result<(), Cancelled> {
    if current_generation() != generation {
        return Err(Cancelled);
    }
    let Ok(entries) = fs::read_dir(dir) else {
        return Ok(()); // unreadable: skip silently
    };
    for entry in entries.flatten() {
        let Ok(ft) = entry.file_type() else { continue };
        if !(ft.is_dir() || ft.is_symlink()) {
            continue;
        }
        if should_skip_directory(&entry.file_name().to_string_lossy()) {
            continue;
        }
        // Resolve symlinks; the visited set prevents loops and duplicates.
        let Ok(canonical) = dunce::canonicalize(entry.path()) else { continue };
        if !canonical.is_dir() || !visited.insert(canonical.clone()) {
            continue;
        }
        if is_git_repository(&canonical) {
            discovered.push(canonical);
        } else if depth < max_depth {
            scan(&canonical, depth + 1, max_depth, generation, visited, discovered)?;
        }
    }
    Ok(())
}

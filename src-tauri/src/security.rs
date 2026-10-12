//! Input validation: repository operations are restricted to locations the
//! user explicitly added (workspace folders and directly added repositories).

use std::path::{Path, PathBuf};

use crate::models::AppSettings;
use crate::storage;

fn canonical(p: &str) -> Option<PathBuf> {
    dunce::canonicalize(p).ok()
}

/// Returns true if `path` (already canonical) is inside an allowed location.
pub fn is_allowed(path: &Path, settings: &AppSettings) -> bool {
    settings
        .workspace_folders
        .iter()
        .chain(settings.direct_repositories.iter())
        .filter_map(|root| canonical(root))
        .any(|root| path.starts_with(&root))
}

/// Canonicalize `path` and verify it is inside a user-added location.
pub fn ensure_allowed(path: &str) -> Result<PathBuf, String> {
    if path.is_empty() || path.len() > 4096 || path.contains('\0') {
        return Err("Invalid path".into());
    }
    let canon = canonical(path).ok_or_else(|| format!("Path not found or inaccessible: {}", path))?;
    if !is_allowed(&canon, &storage::load_settings()) {
        return Err(format!("Path is not inside a folder added to RepoLens: {}", path));
    }
    Ok(canon)
}

/// Like [`ensure_allowed`] but also requires the path to be a Git repository root.
pub fn ensure_repository(path: &str) -> Result<PathBuf, String> {
    let p = ensure_allowed(path)?;
    if !crate::scanner::is_git_repository(&p) {
        return Err(format!("Not a Git repository (or it was moved): {}", path));
    }
    Ok(p)
}

/// The scan root must be one of the configured workspace folders (or direct repos).
pub fn ensure_scan_root(path: &str) -> Result<PathBuf, String> {
    let canon = canonical(path).ok_or_else(|| format!("Folder not found or inaccessible: {}", path))?;
    let s = storage::load_settings();
    let configured = s
        .workspace_folders
        .iter()
        .chain(s.direct_repositories.iter())
        .filter_map(|r| canonical(r))
        .any(|r| r == canon);
    if !configured {
        return Err(format!("Folder has not been added to RepoLens: {}", path));
    }
    Ok(canon)
}

/// Validate a repository-relative file path coming from the frontend.
pub fn validate_relative_path(p: &str) -> Result<(), String> {
    if p.is_empty() || p.len() > 4096 || p.contains('\0') {
        return Err("Invalid file path".into());
    }
    let path = Path::new(p);
    if path.is_absolute() || p.starts_with('/') || p.starts_with('\\') {
        return Err("File path must be relative to the repository".into());
    }
    if path.components().any(|c| matches!(c, std::path::Component::ParentDir)) {
        return Err("File path must not contain '..'".into());
    }
    Ok(())
}

use std::fs;
use std::path::PathBuf;
use std::sync::RwLock;

use crate::models::AppSettings;

static CACHE: RwLock<Option<AppSettings>> = RwLock::new(None);

pub fn get_storage_path() -> Result<PathBuf, String> {
    let mut dir = dirs::data_dir()
        .or_else(dirs::config_dir)
        .ok_or_else(|| "Could not determine the application data directory".to_string())?;
    dir.push("repolens");
    fs::create_dir_all(&dir).map_err(|e| format!("Failed to create {}: {}", dir.display(), e))?;
    dir.push("settings.json");
    Ok(dir)
}

fn read_from_disk() -> AppSettings {
    let Ok(path) = get_storage_path() else {
        return AppSettings::default();
    };
    match fs::read_to_string(&path) {
        Ok(content) => serde_json::from_str(&content).unwrap_or_else(|e| {
            log::warn!("settings.json is invalid ({}); using defaults", e);
            AppSettings::default()
        }),
        Err(_) => AppSettings::default(),
    }
}

/// Load settings (cached after first read).
pub fn load_settings() -> AppSettings {
    if let Some(s) = CACHE.read().unwrap_or_else(|e| e.into_inner()).as_ref() {
        return s.clone();
    }
    let s = read_from_disk();
    *CACHE.write().unwrap_or_else(|e| e.into_inner()) = Some(s.clone());
    s
}

/// Persist settings atomically (write to a temp file, then rename).
pub fn save_settings(settings: &AppSettings) -> Result<(), String> {
    let path = get_storage_path()?;
    let json = serde_json::to_string_pretty(settings).map_err(|e| e.to_string())?;
    let tmp = path.with_extension("json.tmp");
    fs::write(&tmp, json).map_err(|e| format!("Failed to write settings: {}", e))?;
    fs::rename(&tmp, &path).map_err(|e| format!("Failed to save settings: {}", e))?;
    *CACHE.write().unwrap_or_else(|e| e.into_inner()) = Some(settings.clone());
    Ok(())
}

/// Replace the cached settings without touching disk (used by tests).
pub fn set_cached_settings(settings: AppSettings) {
    *CACHE.write().unwrap_or_else(|e| e.into_inner()) = Some(settings);
}

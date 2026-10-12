import { AppSettings } from '../types';
import { isTauri } from './gitService';

const STORAGE_KEY = 'repolens_settings_v1';

export const DEFAULT_SETTINGS: AppSettings = {
  theme: 'system',
  enableTransparency: true,
  workspaceFolders: [],
  directRepositories: [],
  favorites: ['repo-repolens', 'repo-design-system'],
  repoTags: {
    'repo-repolens': ['work', 'rust'],
    'repo-design-system': ['work'],
    'repo-dotfiles': ['personal'],
  },
  maxScanDepth: 3,
  sidebarWidth: 260,
  detailWidth: 520,
  compactMode: false,
  demoMode: !isTauri(),
  liveRefresh: true,
  diffViewMode: 'unified',
};

export const settingsService = {
  async loadSettings(): Promise<AppSettings> {
    if (!isTauri()) {
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          const parsed = JSON.parse(stored);
          return { ...DEFAULT_SETTINGS, ...parsed, demoMode: true };
        }
      } catch (e) {
        console.warn('Failed to load settings from localStorage:', e);
      }
      return { ...DEFAULT_SETTINGS, demoMode: true };
    }

    try {
      const { invoke } = await import('@tauri-apps/api/core');
      const loaded = await invoke<AppSettings>('load_settings');
      return { ...DEFAULT_SETTINGS, ...loaded };
    } catch (e) {
      console.warn('Failed to load settings from Tauri, using local fallback:', e);
      try {
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          return { ...DEFAULT_SETTINGS, ...JSON.parse(stored) };
        }
      } catch {
        // ignore
      }
      return DEFAULT_SETTINGS;
    }
  },

  async saveSettings(settings: AppSettings): Promise<void> {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    } catch (e) {
      console.warn('Failed to persist settings to localStorage:', e);
    }

    if (isTauri()) {
      try {
        const { invoke } = await import('@tauri-apps/api/core');
        await invoke('save_settings', { settings });
      } catch (e) {
        console.error('Failed to save settings to Tauri backend:', e);
      }
    }
  },
};

import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Sliders,
  Folder,
  Trash2,
  FolderPlus,
  Sparkles,
  Command,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  RotateCw,
  Columns2,
  Rows3,
} from 'lucide-react';
import type { AppSettings, GitEnvironment } from '../types';
import { modKeyLabel } from '../utils/platform';

interface SettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  settings: AppSettings;
  onSaveSettings: (settings: AppSettings) => void;
  gitEnv: GitEnvironment | null;
  onAddFolder: () => void;
  folderRepoCounts: Record<string, number>;
}

export const SettingsModal: React.FC<SettingsModalProps> = ({
  isOpen,
  onClose,
  settings,
  onSaveSettings,
  gitEnv,
  onAddFolder,
  folderRepoCounts,
}) => {
  const modKey = modKeyLabel();

  const updateSetting = <K extends keyof AppSettings>(key: K, value: AppSettings[K]) => {
    onSaveSettings({
      ...settings,
      [key]: value,
    });
  };

  const handleRemoveFolder = (folder: string) => {
    updateSetting(
      'workspaceFolders',
      settings.workspaceFolders.filter((f) => f !== folder)
    );
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="w-full max-w-xl max-h-[85vh] flex flex-col bg-white dark:bg-neutral-900 border hairline rounded-xl shadow-2xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="px-5 py-3.5 border-b hairline flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-blue-600 dark:text-blue-400" />
                <h3 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                  RepoLens Preferences
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                className="icon-btn"
                title="Close (Esc)"
                aria-label="Close settings"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-5 space-y-6 text-xs">
              {/* Appearance Section */}
              <section className="space-y-3">
                <h4 className="section-label">Appearance & Layout</h4>

                {/* Theme switcher */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">Theme</span>
                    <p className="text-[11px] text-neutral-500">
                      Select interface appearance or match system
                    </p>
                  </div>

                  <div className="segmented" role="group" aria-label="Theme mode">
                    <button
                      type="button"
                      aria-pressed={settings.theme === 'light'}
                      onClick={() => updateSetting('theme', 'light')}
                      className="flex items-center gap-1.5"
                    >
                      <Sun className="w-3.5 h-3.5" />
                      <span>Light</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.theme === 'system'}
                      onClick={() => updateSetting('theme', 'system')}
                      className="flex items-center gap-1.5"
                    >
                      <Monitor className="w-3.5 h-3.5" />
                      <span>System</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.theme === 'dark'}
                      onClick={() => updateSetting('theme', 'dark')}
                      className="flex items-center gap-1.5"
                    >
                      <Moon className="w-3.5 h-3.5" />
                      <span>Dark</span>
                    </button>
                  </div>
                </div>

                {/* Transparency Toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      Native Window Vibrancy (macOS)
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Translucent sidebar and toolbar with opaque readable content surfaces
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.enableTransparency}
                    onChange={(e) => updateSetting('enableTransparency', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700 cursor-pointer accent-blue-600"
                  />
                </div>

                {/* Default Diff Layout */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      Default Diff Layout
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Preferred display mode for commit and file diffs
                    </p>
                  </div>

                  <div className="segmented" role="group" aria-label="Default diff layout">
                    <button
                      type="button"
                      aria-pressed={settings.diffViewMode === 'unified'}
                      onClick={() => updateSetting('diffViewMode', 'unified')}
                      className="flex items-center gap-1.5"
                    >
                      <Rows3 className="w-3.5 h-3.5" />
                      <span>Unified</span>
                    </button>
                    <button
                      type="button"
                      aria-pressed={settings.diffViewMode === 'split'}
                      onClick={() => updateSetting('diffViewMode', 'split')}
                      className="flex items-center gap-1.5"
                    >
                      <Columns2 className="w-3.5 h-3.5" />
                      <span>Side-by-side</span>
                    </button>
                  </div>
                </div>

                {/* Compact mode toggle */}
                <div className="flex items-center justify-between py-1">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      Compact Repository Rows
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Tighter padding in the repository list for high information density
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.compactMode}
                    onChange={(e) => updateSetting('compactMode', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700 cursor-pointer accent-blue-600"
                  />
                </div>
              </section>

              {/* Automation & Live Refresh */}
              <section className="space-y-3 pt-3 border-t hairline">
                <h4 className="section-label">Automation & Live Monitoring</h4>

                <div className="flex items-center justify-between py-1">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <RotateCw className="w-3.5 h-3.5 text-blue-500" />
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">
                        Live Auto-Refresh (Filesystem Watcher)
                      </span>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      Automatically detect branch changes, commits, and modifications with debounced filesystem events
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.liveRefresh}
                    onChange={(e) => updateSetting('liveRefresh', e.target.checked)}
                    className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-neutral-300 dark:border-neutral-700 cursor-pointer accent-blue-600"
                  />
                </div>
              </section>

              {/* Workspaces Section */}
              <section className="space-y-3 pt-3 border-t hairline">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="section-label">Configured Workspaces</h4>
                    <p className="text-[11px] text-neutral-500">
                      Folders scanned for Git repositories (up to {settings.maxScanDepth} levels deep)
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={onAddFolder}
                    className="btn"
                  >
                    <FolderPlus className="w-3.5 h-3.5 text-blue-500" />
                    <span>Add Folder</span>
                  </button>
                </div>

                {settings.workspaceFolders.length === 0 ? (
                  <p className="text-neutral-400 italic py-1">
                    No workspace folders configured.
                  </p>
                ) : (
                  <div className="space-y-1.5 max-h-36 overflow-y-auto">
                    {settings.workspaceFolders.map((folder) => {
                      const count = folderRepoCounts[folder] ?? 0;
                      return (
                        <div
                          key={folder}
                          className="flex items-center justify-between p-2 rounded-md bg-neutral-50 dark:bg-neutral-800/60 border hairline font-mono text-[11px]"
                        >
                          <div className="flex items-center gap-2 truncate mr-2">
                            <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                            <span className="truncate">{folder}</span>
                            <span className="text-[10px] text-neutral-400 font-sans">
                              ({count} repo{count === 1 ? '' : 's'})
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleRemoveFolder(folder)}
                            className="text-neutral-400 hover:text-rose-500 p-0.5 transition-colors"
                            title="Remove workspace folder"
                            aria-label={`Remove workspace ${folder}`}
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Scan depth control */}
                <div className="flex items-center justify-between pt-1">
                  <div>
                    <span className="font-medium text-neutral-800 dark:text-neutral-200">
                      Scan Depth: {settings.maxScanDepth} level{settings.maxScanDepth > 1 ? 's' : ''}
                    </span>
                    <p className="text-[11px] text-neutral-500">
                      Maximum directory depth when scanning workspace folders
                    </p>
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    value={settings.maxScanDepth}
                    onChange={(e) => updateSetting('maxScanDepth', parseInt(e.target.value, 10))}
                    className="w-32 cursor-pointer accent-blue-600"
                  />
                </div>
              </section>

              {/* Git Environment Section */}
              <section className="space-y-3 pt-3 border-t hairline">
                <h4 className="section-label">Git Environment</h4>
                <div className="p-3 rounded-lg bg-neutral-50 dark:bg-neutral-800/60 border hairline space-y-1.5">
                  <div className="flex items-center justify-between">
                    <span className="text-neutral-500">Status</span>
                    <div className="flex items-center gap-1.5 font-medium">
                      {gitEnv?.installed ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500" />
                          <span className="text-emerald-700 dark:text-emerald-400">Git Available</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-3.5 h-3.5 text-amber-500" />
                          <span className="text-amber-700 dark:text-amber-400">Git Not Found</span>
                        </>
                      )}
                    </div>
                  </div>

                  {gitEnv?.installed && (
                    <>
                      <div className="flex items-center justify-between">
                        <span className="text-neutral-500">Version</span>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200">
                          {gitEnv.version}
                        </span>
                      </div>
                      <div className="flex items-center justify-between truncate">
                        <span className="text-neutral-500 shrink-0 mr-2">Executable</span>
                        <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate">
                          {gitEnv.executablePath}
                        </span>
                      </div>
                      {gitEnv.userEmail && (
                        <div className="flex items-center justify-between truncate">
                          <span className="text-neutral-500 shrink-0 mr-2">User Email</span>
                          <span className="font-mono text-neutral-800 dark:text-neutral-200 truncate">
                            {gitEnv.userEmail}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>
              </section>

              {/* Demo Mode Toggle */}
              <section className="space-y-3 pt-3 border-t hairline">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                      <span className="font-medium text-neutral-800 dark:text-neutral-200">Demo Mode</span>
                    </div>
                    <p className="text-[11px] text-neutral-500">
                      Simulate Git operations with mock repositories for demonstration and testing
                    </p>
                  </div>
                  <input
                    type="checkbox"
                    checked={settings.demoMode}
                    onChange={(e) => updateSetting('demoMode', e.target.checked)}
                    className="w-4 h-4 rounded text-amber-600 focus:ring-amber-500 border-neutral-300 dark:border-neutral-700 cursor-pointer accent-amber-600"
                  />
                </div>
              </section>

              {/* Keyboard Shortcuts Reference */}
              <section className="space-y-2 pt-3 border-t hairline">
                <div className="flex items-center gap-1.5 section-label">
                  <Command className="w-3.5 h-3.5" />
                  <span>Keyboard Shortcuts</span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center justify-between p-1.5 rounded bg-neutral-50 dark:bg-neutral-800/40 border hairline">
                    <span className="text-neutral-600 dark:text-neutral-400">Search repos</span>
                    <kbd className="kbd">{modKey}F</kbd>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-neutral-50 dark:bg-neutral-800/40 border hairline">
                    <span className="text-neutral-600 dark:text-neutral-400">Refresh repos</span>
                    <kbd className="kbd">{modKey}R</kbd>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-neutral-50 dark:bg-neutral-800/40 border hairline">
                    <span className="text-neutral-600 dark:text-neutral-400">Command Palette</span>
                    <kbd className="kbd">{modKey}K</kbd>
                  </div>
                  <div className="flex items-center justify-between p-1.5 rounded bg-neutral-50 dark:bg-neutral-800/40 border hairline">
                    <span className="text-neutral-600 dark:text-neutral-400">Preferences</span>
                    <kbd className="kbd">{modKey},</kbd>
                  </div>
                </div>
              </section>
            </div>

            {/* Modal Footer */}
            <div className="px-5 py-3 border-t hairline bg-neutral-50/50 dark:bg-neutral-850/50 flex justify-end">
              <button
                type="button"
                onClick={onClose}
                className="btn-primary px-4"
              >
                Done
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

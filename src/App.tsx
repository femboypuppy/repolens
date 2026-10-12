import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { MotionConfig, motion, AnimatePresence } from 'motion/react';
import {
  AlertTriangle,
  Sparkles,
} from 'lucide-react';
import type {
  AppSettings,
  DiffViewMode,
  FilterCategory,
  GitEnvironment,
  MainView,
  Repository,
  SortDirection,
  SortField,
} from './types';
import { gitService, isTauri, setDemoMode } from './services/gitService';
import { settingsService, DEFAULT_SETTINGS } from './services/settingsService';
import { isMacOS, usePrefersReducedTransparency } from './utils/platform';
import { HeaderToolbar } from './components/HeaderToolbar';
import { Sidebar } from './components/Sidebar';
import { RepositoryList } from './components/RepositoryList';
import { FleetOverview } from './components/FleetOverview';
import { DetailPane } from './components/DetailPane';
import { FirstRunView } from './components/FirstRunView';
import { SettingsModal } from './components/SettingsModal';
import { CommandPalette } from './components/CommandPalette';
import { ActivityView } from './components/ActivityView';
import { SearchView } from './components/SearchView';
import { UnpushedBanner } from './components/UnpushedBanner';

export const App: React.FC = () => {
  const [settings, setSettings] = useState<AppSettings>(DEFAULT_SETTINGS);
  const [gitEnv, setGitEnv] = useState<GitEnvironment | null>(null);
  const [repositories, setRepositories] = useState<Repository[]>([]);
  const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [currentFilter, setCurrentFilter] = useState<FilterCategory>('all');
  const [currentView, setCurrentView] = useState<MainView>('repositories');
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isCommandPaletteOpen, setIsCommandPaletteOpen] = useState(false);
  const [isFleetView, setIsFleetView] = useState(false);

  // Resizable pane widths with ref tracking to prevent stale state on drag-end
  const [sidebarWidth, setSidebarWidth] = useState(250);
  const [detailWidth, setDetailWidth] = useState(520);
  const sidebarWidthRef = useRef(sidebarWidth);
  const detailWidthRef = useRef(detailWidth);
  sidebarWidthRef.current = sidebarWidth;
  detailWidthRef.current = detailWidth;

  const refreshGeneration = useRef(0);
  const prefersReducedTransparency = usePrefersReducedTransparency();

  // Apply theme to document
  useEffect(() => {
    const root = document.documentElement;
    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const applyTheme = () => {
      if (settings.theme === 'dark') {
        root.classList.add('dark');
      } else if (settings.theme === 'light') {
        root.classList.remove('dark');
      } else {
        if (mediaQuery.matches) {
          root.classList.add('dark');
        } else {
          root.classList.remove('dark');
        }
      }
    };

    applyTheme();
    mediaQuery.addEventListener('change', applyTheme);
    return () => mediaQuery.removeEventListener('change', applyTheme);
  }, [settings.theme]);

  // Apply macOS native vibrancy effect class
  useEffect(() => {
    const root = document.documentElement;
    const shouldVibrate =
      isTauri() &&
      isMacOS() &&
      settings.enableTransparency &&
      !prefersReducedTransparency;

    if (shouldVibrate) {
      root.classList.add('vibrancy');
    } else {
      root.classList.remove('vibrancy');
    }
  }, [settings.enableTransparency, prefersReducedTransparency]);

  // Sync demo mode router
  useEffect(() => {
    setDemoMode(settings.demoMode);
  }, [settings.demoMode]);

  // Load initial settings and environment
  useEffect(() => {
    async function init() {
      const loadedSettings = await settingsService.loadSettings();
      setSettings(loadedSettings);
      setSidebarWidth(loadedSettings.sidebarWidth || 250);
      setDetailWidth(loadedSettings.detailWidth || 520);
      setDemoMode(loadedSettings.demoMode);

      try {
        const env = await gitService.getEnvironment();
        setGitEnv(env);
      } catch (e) {
        console.warn('Could not determine Git environment:', e);
      }
    }
    init();
  }, []);

  // Save settings helper: save to disk before updating React state to guarantee consistency
  const handleSaveSettings = useCallback(async (newSettings: AppSettings) => {
    await settingsService.saveSettings(newSettings);
    setSettings(newSettings);
  }, []);

  // Refresh and discover repositories
  const refreshRepositories = useCallback(async () => {
    const currentGen = ++refreshGeneration.current;
    setIsRefreshing(true);

    try {
      if (settings.demoMode) {
        const demoRepos = gitService.demoRepositories();
        if (currentGen !== refreshGeneration.current) return;
        setRepositories(
          demoRepos.map((r) => ({
            ...r,
            isFavorite: settings.favorites.includes(r.id),
          }))
        );
        setIsRefreshing(false);
        return;
      }

      const allDiscoveredPaths = new Map<string, string>(); // path -> workspacePath

      // Scan each configured workspace folder
      for (const folder of settings.workspaceFolders) {
        try {
          const repoPaths = await gitService.scanWorkspace(folder, settings.maxScanDepth);
          for (const rp of repoPaths) {
            allDiscoveredPaths.set(rp, folder);
          }
        } catch (e) {
          console.warn(`Scan error on folder ${folder}:`, e);
        }
      }

      // Add direct repositories
      for (const dirRepo of settings.directRepositories) {
        allDiscoveredPaths.set(dirRepo, '');
      }

      if (currentGen !== refreshGeneration.current) return;

      // Inspect all discovered repositories in parallel
      const pathList = Array.from(allDiscoveredPaths.entries());
      const inspected = await Promise.all(
        pathList.map(async ([p, ws]) => {
          try {
            const info = await gitService.inspectRepository(p, ws);
            return {
              ...info,
              isFavorite: settings.favorites.includes(info.id) || settings.favorites.includes(p),
            };
          } catch (e) {
            const name = p.split(/[/\\]/).filter(Boolean).pop() || 'unknown';
            return {
              id: p,
              name,
              path: p,
              workspacePath: ws,
              isFavorite: settings.favorites.includes(p),
              currentBranch: '',
              isDetached: false,
              isUnborn: false,
              status: 'clean' as const,
              stagedCount: 0,
              unstagedCount: 0,
              untrackedCount: 0,
              conflictedCount: 0,
              totalChanges: 0,
              lastCommit: null,
              aheadCount: 0,
              behindCount: 0,
              hasUpstream: false,
              upstreamBranch: null,
              localOnlyCommits: 0,
              stashCount: 0,
              remotes: [],
              isAccessible: false,
              errorMessage: String(e),
            };
          }
        })
      );

      if (currentGen !== refreshGeneration.current) return;

      setRepositories(inspected);

      // Start watching repositories if liveRefresh is enabled
      if (settings.liveRefresh && isTauri()) {
        const validPaths = inspected.filter((r) => r.isAccessible).map((r) => r.path);
        gitService.watchRepositories(validPaths).catch((err) => {
          console.warn('Failed to watch repositories:', err);
        });
      }
    } catch (e) {
      console.error('Error during repository refresh:', e);
    } finally {
      if (currentGen === refreshGeneration.current) {
        setIsRefreshing(false);
      }
    }
  }, [
    settings.workspaceFolders,
    settings.directRepositories,
    settings.favorites,
    settings.demoMode,
    settings.maxScanDepth,
    settings.liveRefresh,
  ]);

  // Cancel running scan
  const handleCancelScan = useCallback(() => {
    gitService.cancelScan();
    setIsRefreshing(false);
  }, []);

  // Trigger refresh on setting changes
  useEffect(() => {
    refreshRepositories();
  }, [refreshRepositories]);

  // Setup live event listeners: repo-changed and tray-select-repo
  useEffect(() => {
    let unlistenChanged: (() => void) | null = null;
    let unlistenTray: (() => void) | null = null;

    if (isTauri()) {
      // Re-inspect only changed repos on filesystem events
      gitService
        .listen<string[]>('repo-changed', async (changedPaths) => {
          if (!changedPaths || changedPaths.length === 0) return;
          setRepositories((prev) => {
            // Asynchronously inspect and replace changed items
            (async () => {
              for (const path of changedPaths) {
                try {
                  const existing = prev.find((r) => r.path === path);
                  const updated = await gitService.inspectRepository(path, existing?.workspacePath);
                  setRepositories((curr) =>
                    curr.map((r) =>
                      r.path === path
                        ? { ...updated, isFavorite: settings.favorites.includes(updated.id) }
                        : r
                    )
                  );
                } catch {
                  // ignore transient errors while git locks exist
                }
              }
            })();
            return prev;
          });
        })
        .then((fn) => {
          unlistenChanged = fn;
        });

      // Jump to repo on tray menu click
      gitService
        .listen<string>('tray-select-repo', (repoId) => {
          setSelectedRepoId(repoId);
          setCurrentView('repositories');
        })
        .then((fn) => {
          unlistenTray = fn;
        });
    }

    return () => {
      unlistenChanged?.();
      unlistenTray?.();
    };
  }, [settings.favorites]);

  // Update system tray after repositories change
  useEffect(() => {
    if (!isTauri() || repositories.length === 0) return;

    let changeCount = 0;
    let unpushedCount = 0;
    const modifiedList: { id: string; name: string; changes: number }[] = [];

    for (const r of repositories) {
      if (r.status !== 'clean') {
        changeCount++;
        modifiedList.push({ id: r.id, name: r.name, changes: r.totalChanges });
      }
      if (r.aheadCount > 0 || r.localOnlyCommits > 0) {
        unpushedCount++;
      }
    }

    gitService.updateTray({
      changedCount: changeCount,
      unpushedCount,
      repos: modifiedList.slice(0, 5),
    });
  }, [repositories]);

  // Window focus auto-refresh (if liveRefresh is enabled)
  useEffect(() => {
    const onFocus = () => {
      if (settings.liveRefresh && !settings.demoMode) {
        refreshRepositories();
      }
    };
    window.addEventListener('focus', onFocus);
    return () => window.removeEventListener('focus', onFocus);
  }, [settings.liveRefresh, settings.demoMode, refreshRepositories]);

  // Add workspace folder
  const handleAddFolder = async () => {
    try {
      const selected = await gitService.pickFolder('Select Workspace Folder to Scan');
      if (selected && !settings.workspaceFolders.includes(selected)) {
        const updated = {
          ...settings,
          workspaceFolders: [...settings.workspaceFolders, selected],
          demoMode: false,
        };
        handleSaveSettings(updated);
      }
    } catch (e) {
      console.error('Failed to add workspace folder:', e);
    }
  };

  // Add direct repository
  const handleAddDirectRepo = async () => {
    try {
      const selected = await gitService.pickFolder('Select Git Repository Folder');
      if (selected && !settings.directRepositories.includes(selected)) {
        const updated = {
          ...settings,
          directRepositories: [...settings.directRepositories, selected],
          demoMode: false,
        };
        handleSaveSettings(updated);
      }
    } catch (e) {
      console.error('Failed to add direct repository:', e);
    }
  };

  // Toggle favorite
  const handleToggleFavorite = (repoId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newFavorites = settings.favorites.includes(repoId)
      ? settings.favorites.filter((id) => id !== repoId)
      : [...settings.favorites, repoId];

    handleSaveSettings({
      ...settings,
      favorites: newFavorites,
    });

    setRepositories((prev) =>
      prev.map((r) => (r.id === repoId ? { ...r, isFavorite: !r.isFavorite } : r))
    );
  };

  // Tag management
  const handleAddRepoTag = useCallback(
    (repoId: string, tag: string) => {
      const existing = settings.repoTags[repoId] || [];
      if (!existing.includes(tag)) {
        const updatedTags = {
          ...settings.repoTags,
          [repoId]: [...existing, tag],
        };
        handleSaveSettings({ ...settings, repoTags: updatedTags });
      }
    },
    [settings, handleSaveSettings]
  );

  const handleRemoveRepoTag = useCallback(
    (repoId: string, tag: string) => {
      const existing = settings.repoTags[repoId] || [];
      const updatedTags = {
        ...settings.repoTags,
        [repoId]: existing.filter((t) => t !== tag),
      };
      handleSaveSettings({ ...settings, repoTags: updatedTags });
    },
    [settings, handleSaveSettings]
  );

  // Keyboard shortcuts listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const isMeta = e.metaKey || e.ctrlKey;

      if (isMeta && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setIsCommandPaletteOpen((prev) => !prev);
      } else if (isMeta && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setCurrentView('repositories');
        const searchInput = document.getElementById('repo-search-input');
        searchInput?.focus();
      } else if (isMeta && e.key.toLowerCase() === 'r') {
        e.preventDefault();
        refreshRepositories();
      } else if (isMeta && e.key === ',') {
        e.preventDefault();
        setIsSettingsOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        if (isCommandPaletteOpen) {
          setIsCommandPaletteOpen(false);
        } else if (isSettingsOpen) {
          setIsSettingsOpen(false);
        } else if (searchQuery) {
          setSearchQuery('');
        } else if (selectedRepoId) {
          setSelectedRepoId(null);
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isCommandPaletteOpen, isSettingsOpen, searchQuery, selectedRepoId, refreshRepositories]);

  // Sidebar resize handler using refs to prevent stale width on mouseUp
  const handleSidebarResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = sidebarWidthRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(200, Math.min(420, startWidth + (moveEvent.clientX - startX)));
      setSidebarWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      handleSaveSettings({ ...settings, sidebarWidth: sidebarWidthRef.current });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Detail pane resize handler
  const handleDetailResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = detailWidthRef.current;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const newWidth = Math.max(380, Math.min(750, startWidth - (moveEvent.clientX - startX)));
      setDetailWidth(newWidth);
    };

    const onMouseUp = () => {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      handleSaveSettings({ ...settings, detailWidth: detailWidthRef.current });
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  // Filtered and sorted repositories
  const filteredRepositories = useMemo(() => {
    return repositories
      .filter((repo) => {
        // Category filter
        if (currentFilter === 'favorites') {
          if (!repo.isFavorite) return false;
        } else if (currentFilter === 'changes') {
          if (repo.status === 'clean') return false;
        } else if (currentFilter === 'unpushed') {
          if (repo.aheadCount === 0 && repo.localOnlyCommits === 0) return false;
        } else if (typeof currentFilter !== 'string') {
          if ('folder' in currentFilter) {
            if (repo.workspacePath !== currentFilter.folder) return false;
          } else if ('tag' in currentFilter) {
            const tags = settings.repoTags[repo.id] || [];
            if (!tags.includes(currentFilter.tag)) return false;
          }
        }

        // Search text query
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          const matchName = repo.name.toLowerCase().includes(q);
          const matchPath = repo.path.toLowerCase().includes(q);
          const matchBranch = repo.currentBranch.toLowerCase().includes(q);
          const tags = settings.repoTags[repo.id] || [];
          const matchTag = tags.some((t) => t.toLowerCase().includes(q));
          if (!matchName && !matchPath && !matchBranch && !matchTag) return false;
        }

        return true;
      })
      .sort((a, b) => {
        let cmp = 0;
        if (sortField === 'name') {
          cmp = a.name.localeCompare(b.name);
        } else if (sortField === 'recentCommit') {
          const dateA = a.lastCommit ? new Date(a.lastCommit.date).getTime() : 0;
          const dateB = b.lastCommit ? new Date(b.lastCommit.date).getTime() : 0;
          cmp = dateA - dateB;
        } else if (sortField === 'changes') {
          cmp = a.totalChanges - b.totalChanges;
        } else if (sortField === 'branch') {
          cmp = a.currentBranch.localeCompare(b.currentBranch);
        }

        return sortDirection === 'asc' ? cmp : -cmp;
      });
  }, [repositories, currentFilter, searchQuery, sortField, sortDirection, settings.repoTags]);

  // Counts for sidebar
  const counts = useMemo(() => {
    const perFolder: Record<string, number> = {};
    const perTag: Record<string, number> = {};
    let favCount = 0;
    let changeCount = 0;
    let unpushedCount = 0;

    for (const r of repositories) {
      if (r.isFavorite) favCount++;
      if (r.status !== 'clean') changeCount++;
      if (r.aheadCount > 0 || r.localOnlyCommits > 0) unpushedCount++;
      if (r.workspacePath) {
        perFolder[r.workspacePath] = (perFolder[r.workspacePath] || 0) + 1;
      }
      const tags = settings.repoTags[r.id] || [];
      for (const t of tags) {
        perTag[t] = (perTag[t] || 0) + 1;
      }
    }

    return {
      all: repositories.length,
      favorites: favCount,
      changes: changeCount,
      unpushed: unpushedCount,
      perFolder,
      perTag,
    };
  }, [repositories, settings.repoTags]);

  const selectedRepository = useMemo(() => {
    return repositories.find((r) => r.id === selectedRepoId) || null;
  }, [repositories, selectedRepoId]);

  const isFirstRun =
    settings.workspaceFolders.length === 0 &&
    settings.directRepositories.length === 0 &&
    !settings.demoMode;

  const gitMissing = gitEnv && !gitEnv.installed && !settings.demoMode;

  return (
    <MotionConfig reducedMotion="user">
      <div className="flex h-screen w-screen overflow-hidden text-neutral-900 dark:text-neutral-100 font-sans antialiased">
        {/* Left Sidebar */}
        <Sidebar
          currentFilter={currentFilter}
          onSelectFilter={(filter) => {
            setCurrentFilter(filter);
            setCurrentView('repositories');
          }}
          workspaceFolders={settings.workspaceFolders}
          directRepositories={settings.directRepositories}
          repoTags={settings.repoTags}
          onRemoveFolder={(folder) =>
            handleSaveSettings({
              ...settings,
              workspaceFolders: settings.workspaceFolders.filter((f) => f !== folder),
            })
          }
          onRemoveDirectRepo={(repoPath) =>
            handleSaveSettings({
              ...settings,
              directRepositories: settings.directRepositories.filter((r) => r !== repoPath),
            })
          }
          onAddFolder={handleAddFolder}
          counts={counts}
          gitEnv={gitEnv}
          theme={settings.theme}
          onThemeChange={(th) => handleSaveSettings({ ...settings, theme: th })}
          width={sidebarWidth}
          onResizeStart={handleSidebarResize}
          translucent={settings.enableTransparency}
        />

        {/* Main Center Area */}
        <div className="flex-1 flex flex-col min-w-0 h-full overflow-hidden content-surface">
          {/* Top Header Toolbar */}
          <HeaderToolbar
            currentView={currentView}
            onViewChange={setCurrentView}
            searchQuery={searchQuery}
            onSearchChange={setSearchQuery}
            sortField={sortField}
            sortDirection={sortDirection}
            onSortChange={(f, d) => {
              setSortField(f);
              setSortDirection(d);
            }}
            onRefresh={refreshRepositories}
            isRefreshing={isRefreshing}
            onCancelScan={handleCancelScan}
            onAddFolder={handleAddFolder}
            onAddDirectRepo={handleAddDirectRepo}
            onOpenSettings={() => setIsSettingsOpen(true)}
            onOpenCommandPalette={() => setIsCommandPaletteOpen(true)}
            isFleetView={isFleetView}
            onToggleFleetView={() => setIsFleetView((prev) => !prev)}
            isDemoMode={settings.demoMode}
            translucent={settings.enableTransparency}
          />

          {/* Git Missing Warning Banner */}
          {gitMissing && (
            <div className="mx-4 mt-3 p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-800 dark:text-rose-200 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0" />
                <span>
                  <strong>Git executable was not detected on your system PATH.</strong> RepoLens operates in read-only mode, but requires Git installed.
                </span>
              </div>
              <button
                type="button"
                onClick={() => handleSaveSettings({ ...settings, demoMode: true })}
                className="btn text-xs text-rose-700 dark:text-rose-300 shrink-0"
              >
                <Sparkles className="w-3.5 h-3.5" />
                <span>Switch to Demo Mode</span>
              </button>
            </div>
          )}

          {/* Unpushed Work Radar Banner */}
          {currentView === 'repositories' && (
            <UnpushedBanner
              repositories={repositories}
              isUnpushedFilterActive={currentFilter === 'unpushed'}
              onFilterUnpushed={() => setCurrentFilter('unpushed')}
            />
          )}

          {/* Dynamic Content Views */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden">
            {isFirstRun ? (
              <FirstRunView
                onAddFolder={handleAddFolder}
                onAddDirectRepo={handleAddDirectRepo}
                onTryDemo={() => handleSaveSettings({ ...settings, demoMode: true })}
              />
            ) : currentView === 'activity' ? (
              <ActivityView
                repositories={repositories}
                onSelectRepo={(repo) => {
                  setSelectedRepoId(repo.id);
                  setCurrentView('repositories');
                }}
              />
            ) : currentView === 'search' ? (
              <SearchView
                repositories={repositories}
                onSelectRepo={(repo) => {
                  setSelectedRepoId(repo.id);
                  setCurrentView('repositories');
                }}
              />
            ) : isFleetView ? (
              <FleetOverview
                repositories={filteredRepositories}
                selectedRepoId={selectedRepoId}
                onSelectRepo={(r) => setSelectedRepoId(r.id)}
                onToggleFavorite={handleToggleFavorite}
                onOpenVsCode={(path, e) => {
                  e.stopPropagation();
                  gitService.openInVsCode(path);
                }}
                onOpenTerminal={(path, e) => {
                  e.stopPropagation();
                  gitService.openInTerminal(path);
                }}
                onOpenFileManager={(path, e) => {
                  e.stopPropagation();
                  gitService.openInFileManager(path);
                }}
              />
            ) : (
              <RepositoryList
                repositories={filteredRepositories}
                selectedRepoId={selectedRepoId}
                onSelectRepo={(r) => setSelectedRepoId(r.id)}
                onToggleFavorite={handleToggleFavorite}
                compactMode={settings.compactMode}
                searchQuery={searchQuery}
                onClearSearch={() => setSearchQuery('')}
                repoTags={settings.repoTags}
                isLoading={isRefreshing}
              />
            )}
          </div>
        </div>

        {/* Right Detail Pane with short slide/fade animation */}
        <AnimatePresence>
          {selectedRepository && (
            <motion.div
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: detailWidth, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.16, ease: 'easeInOut' }}
              className="h-full flex overflow-hidden shrink-0"
            >
              <DetailPane
                repository={selectedRepository}
                onClose={() => setSelectedRepoId(null)}
                onToggleFavorite={handleToggleFavorite}
                tags={settings.repoTags[selectedRepository.id] || []}
                onAddTag={(tag) => handleAddRepoTag(selectedRepository.id, tag)}
                onRemoveTag={(tag) => handleRemoveRepoTag(selectedRepository.id, tag)}
                width={detailWidth}
                onResizeStart={handleDetailResize}
                diffMode={settings.diffViewMode}
                onDiffModeChange={(m: DiffViewMode) => handleSaveSettings({ ...settings, diffViewMode: m })}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Settings Modal */}
        <SettingsModal
          isOpen={isSettingsOpen}
          onClose={() => setIsSettingsOpen(false)}
          settings={settings}
          onSaveSettings={handleSaveSettings}
          gitEnv={gitEnv}
          onAddFolder={handleAddFolder}
          folderRepoCounts={counts.perFolder}
        />

        {/* Universal Command Palette (Ctrl+K / ⌘K) */}
        <CommandPalette
          isOpen={isCommandPaletteOpen}
          onClose={() => setIsCommandPaletteOpen(false)}
          repositories={repositories}
          selectedRepo={selectedRepository}
          onSelectRepo={(r) => {
            setSelectedRepoId(r.id);
            setCurrentView('repositories');
          }}
          onAddFolder={handleAddFolder}
          onAddDirectRepo={handleAddDirectRepo}
          onRefresh={refreshRepositories}
          onOpenSettings={() => setIsSettingsOpen(true)}
          onOpenVsCode={(path) => gitService.openInVsCode(path)}
          onOpenTerminal={(path) => gitService.openInTerminal(path)}
          onOpenFileManager={(path) => gitService.openInFileManager(path)}
          onToggleTheme={(th) => handleSaveSettings({ ...settings, theme: th })}
          onToggleDemo={() => handleSaveSettings({ ...settings, demoMode: !settings.demoMode })}
          isFleetView={isFleetView}
          onToggleFleetView={() => setIsFleetView((prev) => !prev)}
          onSelectView={setCurrentView}
          onFilterUnpushed={() => {
            setCurrentFilter('unpushed');
            setCurrentView('repositories');
          }}
        />
      </div>
    </MotionConfig>
  );
};

export default App;

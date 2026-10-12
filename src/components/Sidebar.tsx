import React from 'react';
import {
  FolderGit2,
  Star,
  FileCode2,
  Folder,
  Trash2,
  FolderPlus,
  GitBranch,
  Sun,
  Moon,
  Monitor,
  CheckCircle2,
  AlertTriangle,
  ArrowUpRight,
  Tag as TagIcon,
  FolderDown,
} from 'lucide-react';
import type { FilterCategory, GitEnvironment } from '../types';
import { isMacOS } from '../utils/platform';

interface SidebarProps {
  currentFilter: FilterCategory;
  onSelectFilter: (filter: FilterCategory) => void;
  workspaceFolders: string[];
  directRepositories: string[];
  repoTags: Record<string, string[]>;
  onRemoveFolder: (folder: string) => void;
  onRemoveDirectRepo: (repoPath: string) => void;
  onAddFolder: () => void;
  onOpenGitHubImport?: () => void;
  counts: {
    all: number;
    favorites: number;
    changes: number;
    unpushed: number;
    perFolder: Record<string, number>;
    perTag: Record<string, number>;
  };
  gitEnv: GitEnvironment | null;
  theme: 'system' | 'light' | 'dark';
  onThemeChange: (theme: 'system' | 'light' | 'dark') => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  translucent: boolean;
}

export const Sidebar: React.FC<SidebarProps> = ({
  currentFilter,
  onSelectFilter,
  workspaceFolders,
  directRepositories,
  onRemoveFolder,
  onRemoveDirectRepo,
  onAddFolder,
  onOpenGitHubImport,
  counts,
  gitEnv,
  theme,
  onThemeChange,
  width,
  onResizeStart,
  translucent: _translucent,
}) => {
  const isMac = isMacOS();

  const isSelected = (cat: FilterCategory) => {
    if (typeof cat === 'string') {
      return currentFilter === cat;
    }
    if (typeof currentFilter !== 'string') {
      if ('folder' in cat && 'folder' in currentFilter) {
        return currentFilter.folder === cat.folder;
      }
      if ('tag' in cat && 'tag' in currentFilter) {
        return currentFilter.tag === cat.tag;
      }
    }
    return false;
  };

  const getFolderShortName = (path: string) => {
    const parts = path.split(/[/\\]/).filter(Boolean);
    return parts[parts.length - 1] || path;
  };

  const tagsList = Object.keys(counts.perTag).sort();

  return (
    <aside
      style={{ width }}
      className="relative h-full flex flex-col justify-between border-r hairline chrome-sidebar select-none shrink-0 transition-colors duration-150"
    >
      {/* Top Header & Navigation */}
      <div
        className={`flex-1 overflow-y-auto overflow-x-hidden p-3 space-y-4 ${
          isMac ? 'pt-8' : ''
        }`}
      >
        {/* App Title Header with Drag Region */}
        <div
          data-tauri-drag-region
          className="flex items-center gap-2.5 px-2 py-1.5 cursor-default select-none"
        >
          <div className="w-6 h-6 rounded-lg bg-blue-600 flex items-center justify-center text-white shadow-xs shrink-0">
            <FolderGit2 className="w-3.5 h-3.5" />
          </div>
          <div>
            <h1 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 leading-none">
              RepoLens
            </h1>
            <span className="text-[10px] text-neutral-500 dark:text-neutral-400">
              Local Git Workspace
            </span>
          </div>
        </div>

        {/* Primary Filter Links */}
        <nav className="space-y-0.5" aria-label="Repository filters">
          <button
            type="button"
            onClick={() => onSelectFilter('all')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              isSelected('all')
                ? 'bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <FolderGit2 className="w-4 h-4 text-blue-500" />
              <span>All Repositories</span>
            </div>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {counts.all}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('favorites')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              isSelected('favorites')
                ? 'bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-500/20" />
              <span>Favorites</span>
            </div>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {counts.favorites}
            </span>
          </button>

          <button
            type="button"
            onClick={() => onSelectFilter('changes')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              isSelected('changes')
                ? 'bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <FileCode2 className="w-4 h-4 text-emerald-500" />
              <span>With Changes</span>
            </div>
            <span className="text-[11px] font-mono px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">
              {counts.changes}
            </span>
          </button>

          {/* Unpushed Radar Filter */}
          <button
            type="button"
            onClick={() => onSelectFilter('unpushed')}
            className={`w-full flex items-center justify-between px-2.5 py-1.5 text-xs rounded-md transition-colors ${
              isSelected('unpushed')
                ? 'bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
            }`}
          >
            <div className="flex items-center gap-2">
              <ArrowUpRight className="w-4 h-4 text-amber-500" />
              <span>Unpushed Commits</span>
            </div>
            <span
              className={`text-[11px] font-mono px-1.5 py-0.5 rounded ${
                counts.unpushed > 0
                  ? 'bg-amber-500/20 text-amber-700 dark:text-amber-400 font-semibold'
                  : 'bg-neutral-200/70 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400'
              }`}
            >
              {counts.unpushed}
            </span>
          </button>
        </nav>

        {/* User Tags Section */}
        {tagsList.length > 0 && (
          <div className="pt-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Tags
            </div>
            <div className="space-y-0.5">
              {tagsList.map((tag) => {
                const count = counts.perTag[tag] ?? 0;
                const active = isSelected({ tag });
                return (
                  <button
                    key={tag}
                    type="button"
                    onClick={() => onSelectFilter({ tag })}
                    className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <TagIcon className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                      <span className="truncate">{tag}</span>
                    </div>
                    <span className="text-[10px] font-mono text-neutral-400">{count}</span>
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Workspace Folders Section */}
        <div className="pt-2">
          <div className="flex items-center justify-between px-2 pb-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
            <span>Workspaces</span>
            <button
              type="button"
              onClick={onAddFolder}
              className="text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 p-0.5 rounded"
              title="Add workspace folder"
              aria-label="Add workspace folder"
            >
              <FolderPlus className="w-3.5 h-3.5" />
            </button>
          </div>

          {workspaceFolders.length === 0 ? (
            <div className="px-2 py-2 space-y-1.5">
              <div className="text-xs text-neutral-400 dark:text-neutral-500 italic">
                No workspace folders configured.
              </div>
              {onOpenGitHubImport && (
                <button
                  type="button"
                  onClick={onOpenGitHubImport}
                  className="text-[11px] text-blue-600 dark:text-blue-400 hover:underline flex items-center gap-1 cursor-pointer"
                >
                  <FolderDown className="w-3 h-3" />
                  <span>Import from GitHub</span>
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-0.5">
              {workspaceFolders.map((folder) => {
                const count = counts.perFolder[folder] ?? 0;
                const active = isSelected({ folder });
                return (
                  <div
                    key={folder}
                    className={`group flex items-center justify-between px-2 py-1.5 rounded-md text-xs transition-colors cursor-pointer ${
                      active
                        ? 'bg-neutral-200/90 dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 font-medium'
                        : 'text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50'
                    }`}
                    onClick={() => onSelectFilter({ folder })}
                    title={folder}
                  >
                    <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                      <Folder className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <span className="truncate text-xs">{getFolderShortName(folder)}</span>
                    </div>

                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] font-mono text-neutral-400 dark:text-neutral-500">
                        {count}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onRemoveFolder(folder);
                        }}
                        className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 transition-opacity p-0.5"
                        title="Remove workspace folder from list"
                        aria-label="Remove workspace folder"
                      >
                        <Trash2 className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Direct Repositories (if any) */}
        {directRepositories.length > 0 && (
          <div className="pt-2">
            <div className="px-2 pb-1 text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
              Direct Repositories
            </div>
            <div className="space-y-0.5">
              {directRepositories.map((repoPath) => (
                <div
                  key={repoPath}
                  className="group flex items-center justify-between px-2 py-1.5 rounded-md text-xs text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/50 dark:hover:bg-neutral-800/50"
                  title={repoPath}
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1 mr-1">
                    <GitBranch className="w-3.5 h-3.5 text-blue-500 shrink-0" />
                    <span className="truncate text-xs">{getFolderShortName(repoPath)}</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => onRemoveDirectRepo(repoPath)}
                    className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-500 transition-opacity p-0.5"
                    title="Remove direct repository"
                    aria-label="Remove direct repository"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Footer: Git status, Theme toggle */}
      <footer className="p-3 border-t hairline space-y-2.5">
        {/* Git environment badge */}
        <div className="flex items-center justify-between px-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          <div className="flex items-center gap-1.5 truncate">
            {gitEnv?.installed ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-500 shrink-0" />
                <span className="truncate" title={gitEnv.version}>
                  {gitEnv.version.replace('git version ', 'Git ')}
                </span>
              </>
            ) : (
              <>
                <AlertTriangle className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                <span>Git not detected</span>
              </>
            )}
          </div>
        </div>

        {/* Theme Segmented Switch */}
        <div className="segmented w-full" role="group" aria-label="Theme mode">
          <button
            type="button"
            onClick={() => onThemeChange('light')}
            className="flex-1 inline-flex items-center justify-center py-1"
            title="Light theme"
            aria-label="Light theme"
            aria-pressed={theme === 'light'}
          >
            <Sun className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('system')}
            className="flex-1 inline-flex items-center justify-center py-1"
            title="System theme"
            aria-label="System theme"
            aria-pressed={theme === 'system'}
          >
            <Monitor className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => onThemeChange('dark')}
            className="flex-1 inline-flex items-center justify-center py-1"
            title="Dark theme"
            aria-label="Dark theme"
            aria-pressed={theme === 'dark'}
          >
            <Moon className="w-3.5 h-3.5" />
          </button>
        </div>
      </footer>

      {/* Resize Handle on Right Border */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600 transition-colors z-20"
        title="Drag to resize sidebar"
        aria-hidden="true"
      />
    </aside>
  );
};

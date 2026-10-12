import React from 'react';
import {
  Search,
  X,
  RotateCw,
  FolderPlus,
  GitBranch,
  Settings as SettingsIcon,
  Sparkles,
  Command,
  LayoutGrid,
  List,
  Activity,
  Code2,
  StopCircle,
} from 'lucide-react';
import type { MainView, SortDirection, SortField } from '../types';
import { isMacOS, modKeyLabel } from '../utils/platform';

interface HeaderToolbarProps {
  currentView: MainView;
  onViewChange: (view: MainView) => void;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  sortField: SortField;
  sortDirection: SortDirection;
  onSortChange: (field: SortField, direction: SortDirection) => void;
  onRefresh: () => void;
  isRefreshing: boolean;
  onCancelScan?: () => void;
  onAddFolder: () => void;
  onAddDirectRepo: () => void;
  onOpenGitHubImport: () => void;
  onOpenSettings: () => void;
  onOpenCommandPalette: () => void;
  isFleetView: boolean;
  onToggleFleetView: () => void;
  isDemoMode: boolean;
  translucent: boolean;
}

export const HeaderToolbar: React.FC<HeaderToolbarProps> = ({
  currentView,
  onViewChange,
  searchQuery,
  onSearchChange,
  sortField,
  sortDirection,
  onSortChange,
  onRefresh,
  isRefreshing,
  onCancelScan,
  onAddFolder,
  onAddDirectRepo,
  onOpenGitHubImport,
  onOpenSettings,
  onOpenCommandPalette,
  isFleetView,
  onToggleFleetView,
  isDemoMode,
  translucent: _translucent,
}) => {
  const isMac = isMacOS();
  const modKey = modKeyLabel();

  return (
    <header
      data-tauri-drag-region
      className={`h-13 border-b hairline px-4 flex items-center justify-between gap-3 shrink-0 chrome-toolbar select-none transition-colors duration-150 ${
        isMac ? 'pl-2' : ''
      }`}
    >
      {/* Left section: View Selector & Search bar */}
      <div className="flex items-center gap-2.5 flex-1 max-w-xl">
        {/* Main View Segmented Control */}
        <div className="segmented shrink-0" role="tablist" aria-label="Main Views">
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'repositories'}
            onClick={() => onViewChange('repositories')}
            className="flex items-center gap-1.5"
            title="Repositories"
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Repositories</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'activity'}
            onClick={() => onViewChange('activity')}
            className="flex items-center gap-1.5"
            title="Activity Summary"
          >
            <Activity className="w-3.5 h-3.5 text-blue-500" />
            <span className="hidden sm:inline">Activity</span>
          </button>
          <button
            type="button"
            role="tab"
            aria-selected={currentView === 'search'}
            onClick={() => onViewChange('search')}
            className="flex items-center gap-1.5"
            title="Cross-Repo Search"
          >
            <Code2 className="w-3.5 h-3.5 text-emerald-500" />
            <span className="hidden sm:inline">Search</span>
          </button>
        </div>

        {/* Search input (visible in repositories view) */}
        {currentView === 'repositories' && (
          <div className="relative w-full max-w-xs">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 pointer-events-none" />
            <input
              type="text"
              id="repo-search-input"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder={`Filter repos (${modKey}F)`}
              className="input w-full pl-8 pr-7 text-xs"
              aria-label="Filter repositories"
            />
            {searchQuery && (
              <button
                type="button"
                onClick={() => onSearchChange('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-0.5"
                title="Clear search"
                aria-label="Clear search"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
        )}

        {/* Command palette trigger button */}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="btn h-7 text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 shrink-0"
          title={`Command Palette (${modKey}K)`}
          aria-label="Open Command Palette"
        >
          <Command className="w-3.5 h-3.5" />
          <span className="hidden md:inline font-mono text-[10px] text-neutral-400">{modKey}K</span>
        </button>
      </div>

      {/* Right section: Sort, Fleet Toggle, Actions, Demo badge */}
      <div className="flex items-center gap-2">
        {isDemoMode && (
          <div
            className="flex items-center gap-1 px-2 py-0.5 text-[10.5px] font-medium rounded-full bg-amber-500/10 text-amber-700 dark:text-amber-400 border border-amber-500/20"
            title="Demo Mode: Simulated repositories with functional UI"
          >
            <Sparkles className="w-3 h-3 text-amber-500" />
            <span>Demo Mode</span>
          </div>
        )}

        {currentView === 'repositories' && (
          <>
            {/* View layout toggle (List vs Table) */}
            <div className="segmented shrink-0" role="group" aria-label="Repository layout">
              <button
                type="button"
                aria-pressed={!isFleetView}
                onClick={() => {
                  if (isFleetView) onToggleFleetView();
                }}
                title="List View"
                aria-label="List View"
              >
                <List className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                aria-pressed={isFleetView}
                onClick={() => {
                  if (!isFleetView) onToggleFleetView();
                }}
                title="Fleet Overview Table"
                aria-label="Fleet Overview Table"
              >
                <LayoutGrid className="w-3.5 h-3.5" />
              </button>
            </div>

            {/* Sort selector */}
            <div className="hidden lg:flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-400">
              <select
                value={`${sortField}-${sortDirection}`}
                onChange={(e) => {
                  const [f, d] = e.target.value.split('-');
                  onSortChange(f as SortField, d as SortDirection);
                }}
                className="input h-7 py-0 text-xs cursor-pointer"
                aria-label="Sort repositories by"
              >
                <option value="name-asc">Name (A-Z)</option>
                <option value="name-desc">Name (Z-A)</option>
                <option value="recentCommit-desc">Recently Committed</option>
                <option value="changes-desc">Most Changes</option>
                <option value="branch-asc">Branch Name</option>
              </select>
            </div>
          </>
        )}

        {/* Refresh / Cancel scan button */}
        {isRefreshing && onCancelScan ? (
          <button
            type="button"
            onClick={onCancelScan}
            className="btn text-rose-600 hover:text-rose-700 dark:text-rose-400"
            title="Cancel scan"
            aria-label="Cancel scan"
          >
            <StopCircle className="w-3.5 h-3.5 text-rose-500" />
            <span>Cancel</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="icon-btn"
            title={`Refresh repositories (${modKey}R)`}
            aria-label="Refresh repositories"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-600' : ''}`} />
          </button>
        )}

        {/* Add Folder button */}
        <button
          type="button"
          onClick={onAddFolder}
          className="btn-primary"
          title="Add workspace folder to scan"
        >
          <FolderPlus className="w-3.5 h-3.5" />
          <span className="hidden sm:inline">Add Folder</span>
        </button>

        {/* Add Direct Repo button */}
        <button
          type="button"
          onClick={onAddDirectRepo}
          className="btn"
          title="Add single Git repository directly"
        >
          <GitBranch className="w-3.5 h-3.5" />
          <span className="hidden md:inline">Add Repo</span>
        </button>

        {/* Import from GitHub button */}
        <button
          type="button"
          onClick={onOpenGitHubImport}
          className="btn"
          title="Directly import repositories from a GitHub account"
        >
          <svg className="w-3.5 h-3.5 fill-current" viewBox="0 0 24 24">
            <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
          </svg>
          <span className="hidden lg:inline">Import GitHub</span>
        </button>

        {/* Settings button */}
        <button
          type="button"
          onClick={onOpenSettings}
          className="icon-btn"
          title={`Preferences (${modKey},)`}
          aria-label="Open settings"
        >
          <SettingsIcon className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};

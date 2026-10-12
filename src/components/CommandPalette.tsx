import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search,
  FolderGit2,
  FolderPlus,
  RotateCw,
  Sliders,
  Sparkles,
  Sun,
  Moon,
  Monitor,
  Code2,
  Terminal,
  FolderOpen,
  LayoutGrid,
  List,
  Activity,
  ArrowUpRight,
} from 'lucide-react';
import type { MainView, Repository } from '../types';
import { modKeyLabel } from '../utils/platform';

export interface CommandItem {
  id: string;
  title: string;
  subtitle?: string;
  category: 'Repositories' | 'Navigation' | 'Actions' | 'View & Theme';
  icon: React.ReactNode;
  onSelect: () => void;
}

interface CommandPaletteProps {
  isOpen: boolean;
  onClose: () => void;
  repositories: Repository[];
  selectedRepo: Repository | null;
  onSelectRepo: (repo: Repository) => void;
  onAddFolder: () => void;
  onAddDirectRepo: () => void;
  onRefresh: () => void;
  onOpenSettings: () => void;
  onOpenVsCode: (path: string) => void;
  onOpenTerminal: (path: string) => void;
  onOpenFileManager: (path: string) => void;
  onToggleTheme: (theme: 'system' | 'light' | 'dark') => void;
  onToggleDemo: () => void;
  isFleetView: boolean;
  onToggleFleetView: () => void;
  onSelectView?: (view: MainView) => void;
  onFilterUnpushed?: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  isOpen,
  onClose,
  repositories,
  selectedRepo,
  onSelectRepo,
  onAddFolder,
  onAddDirectRepo,
  onRefresh,
  onOpenSettings,
  onOpenVsCode,
  onOpenTerminal,
  onOpenFileManager,
  onToggleTheme,
  onToggleDemo,
  isFleetView,
  onToggleFleetView,
  onSelectView,
  onFilterUnpushed,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const modKey = modKeyLabel();

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [isOpen]);

  // Build commands list
  const allCommands: CommandItem[] = [
    // Repository items
    ...repositories.map((repo) => ({
      id: `repo-${repo.id}`,
      title: repo.name,
      subtitle: `${repo.currentBranch || 'unborn'} • ${repo.path}`,
      category: 'Repositories' as const,
      icon: <FolderGit2 className="w-4 h-4 text-blue-500" />,
      onSelect: () => {
        onSelectRepo(repo);
        onClose();
      },
    })),

    // Views navigation
    ...(onSelectView
      ? [
          {
            id: 'view-repos',
            title: 'View: All Repositories',
            subtitle: 'Switch to local repository browser',
            category: 'Navigation' as const,
            icon: <FolderGit2 className="w-4 h-4 text-neutral-500" />,
            onSelect: () => {
              onSelectView('repositories');
              onClose();
            },
          },
          {
            id: 'view-activity',
            title: 'View: Activity Summary ("What did I do?")',
            subtitle: 'Review commits authored across all workspaces',
            category: 'Navigation' as const,
            icon: <Activity className="w-4 h-4 text-blue-500" />,
            onSelect: () => {
              onSelectView('activity');
              onClose();
            },
          },
          {
            id: 'view-search',
            title: 'View: Cross-Repository Search (git grep)',
            subtitle: 'Search file contents across repositories',
            category: 'Navigation' as const,
            icon: <Code2 className="w-4 h-4 text-emerald-500" />,
            onSelect: () => {
              onSelectView('search');
              onClose();
            },
          },
        ]
      : []),

    ...(onFilterUnpushed
      ? [
          {
            id: 'filter-unpushed',
            title: 'Filter: Unpushed Commits Radar',
            subtitle: 'Show all repositories with unpushed commits',
            category: 'Navigation' as const,
            icon: <ArrowUpRight className="w-4 h-4 text-amber-500" />,
            onSelect: () => {
              onFilterUnpushed();
              onClose();
            },
          },
        ]
      : []),

    // Contextual repo actions
    ...(selectedRepo
      ? [
          {
            id: 'open-vscode',
            title: `Open "${selectedRepo.name}" in VS Code`,
            subtitle: selectedRepo.path,
            category: 'Actions' as const,
            icon: <Code2 className="w-4 h-4 text-blue-600" />,
            onSelect: () => {
              onOpenVsCode(selectedRepo.path);
              onClose();
            },
          },
          {
            id: 'open-terminal',
            title: `Open "${selectedRepo.name}" in Terminal`,
            subtitle: selectedRepo.path,
            category: 'Actions' as const,
            icon: <Terminal className="w-4 h-4 text-emerald-600" />,
            onSelect: () => {
              onOpenTerminal(selectedRepo.path);
              onClose();
            },
          },
          {
            id: 'open-files',
            title: `Reveal "${selectedRepo.name}" in File Explorer`,
            subtitle: selectedRepo.path,
            category: 'Actions' as const,
            icon: <FolderOpen className="w-4 h-4 text-amber-600" />,
            onSelect: () => {
              onOpenFileManager(selectedRepo.path);
              onClose();
            },
          },
        ]
      : []),

    // General app actions
    {
      id: 'toggle-fleet',
      title: isFleetView ? 'Switch to List View' : 'Switch to Fleet Overview Table',
      subtitle: 'Audit all repositories side-by-side',
      category: 'View & Theme' as const,
      icon: isFleetView ? <List className="w-4 h-4 text-neutral-500" /> : <LayoutGrid className="w-4 h-4 text-neutral-500" />,
      onSelect: () => {
        onToggleFleetView();
        onClose();
      },
    },
    {
      id: 'add-folder',
      title: 'Add Workspace Folder...',
      subtitle: 'Scan directory for Git repositories',
      category: 'Actions' as const,
      icon: <FolderPlus className="w-4 h-4 text-neutral-500" />,
      onSelect: () => {
        onAddFolder();
        onClose();
      },
    },
    {
      id: 'add-direct',
      title: 'Add Repository Directly...',
      subtitle: 'Add a single Git repository to RepoLens',
      category: 'Actions' as const,
      icon: <FolderGit2 className="w-4 h-4 text-neutral-500" />,
      onSelect: () => {
        onAddDirectRepo();
        onClose();
      },
    },
    {
      id: 'refresh-repos',
      title: 'Refresh All Repositories',
      subtitle: 'Rescan workspace folders and update Git status',
      category: 'Actions' as const,
      icon: <RotateCw className="w-4 h-4 text-neutral-500" />,
      onSelect: () => {
        onRefresh();
        onClose();
      },
    },
    {
      id: 'open-settings',
      title: 'Open Settings...',
      subtitle: 'Preferences, workspaces, and Git environment',
      category: 'Actions' as const,
      icon: <Sliders className="w-4 h-4 text-neutral-500" />,
      onSelect: () => {
        onOpenSettings();
        onClose();
      },
    },
    {
      id: 'theme-light',
      title: 'Switch to Light Theme',
      category: 'View & Theme' as const,
      icon: <Sun className="w-4 h-4 text-amber-500" />,
      onSelect: () => {
        onToggleTheme('light');
        onClose();
      },
    },
    {
      id: 'theme-dark',
      title: 'Switch to Dark Theme',
      category: 'View & Theme' as const,
      icon: <Moon className="w-4 h-4 text-blue-400" />,
      onSelect: () => {
        onToggleTheme('dark');
        onClose();
      },
    },
    {
      id: 'theme-system',
      title: 'Switch to System Theme',
      category: 'View & Theme' as const,
      icon: <Monitor className="w-4 h-4 text-neutral-400" />,
      onSelect: () => {
        onToggleTheme('system');
        onClose();
      },
    },
    {
      id: 'toggle-demo',
      title: 'Toggle Demo Mode',
      subtitle: 'Switch between real repositories and simulated demo data',
      category: 'View & Theme' as const,
      icon: <Sparkles className="w-4 h-4 text-amber-500" />,
      onSelect: () => {
        onToggleDemo();
        onClose();
      },
    },
  ];

  // Filter commands
  const filteredCommands = allCommands.filter((cmd) => {
    if (!query.trim()) return true;
    const q = query.toLowerCase();
    return (
      cmd.title.toLowerCase().includes(q) ||
      (cmd.subtitle && cmd.subtitle.toLowerCase().includes(q))
    );
  });

  // Keyboard navigation
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % Math.max(1, filteredCommands.length));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      const item = filteredCommands[selectedIndex];
      if (item) {
        item.onSelect();
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-black/40 backdrop-blur-xs select-none"
          onClick={onClose}
        >
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.14 }}
            className="w-full max-w-xl bg-white dark:bg-neutral-900 border hairline rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[70vh]"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={handleKeyDown}
          >
            {/* Search Input Bar */}
            <div className="relative border-b hairline px-4 py-3 flex items-center gap-3">
              <Search className="w-4 h-4 text-neutral-400 dark:text-neutral-500 shrink-0" />
              <input
                ref={inputRef}
                type="text"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSelectedIndex(0);
                }}
                placeholder={`Type a command or search repositories (${modKey}K)...`}
                className="w-full text-xs bg-transparent text-neutral-900 dark:text-neutral-100 placeholder-neutral-400 dark:placeholder-neutral-500 focus:outline-none"
              />
              <kbd className="kbd">Esc</kbd>
            </div>

            {/* Results List */}
            <div ref={listRef} className="flex-1 overflow-y-auto p-2 space-y-0.5">
              {filteredCommands.length === 0 ? (
                <div className="py-8 text-center text-xs text-neutral-400 italic">
                  No matching commands or repositories found.
                </div>
              ) : (
                filteredCommands.map((item, idx) => {
                  const isSelected = idx === selectedIndex;
                  return (
                    <div
                      key={item.id}
                      onClick={() => item.onSelect()}
                      onMouseEnter={() => setSelectedIndex(idx)}
                      className={`flex items-center justify-between px-3 py-2 rounded-lg text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-blue-600 text-white'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-800 dark:text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center gap-2.5 min-w-0 flex-1 mr-2">
                        <span className={isSelected ? 'text-white' : ''}>{item.icon}</span>
                        <div className="min-w-0 flex-1">
                          <p className="font-medium truncate">{item.title}</p>
                          {item.subtitle && (
                            <p
                              className={`text-[10px] truncate font-mono ${
                                isSelected ? 'text-blue-100' : 'text-neutral-400 dark:text-neutral-500'
                              }`}
                            >
                              {item.subtitle}
                            </p>
                          )}
                        </div>
                      </div>

                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded ${
                          isSelected
                            ? 'bg-blue-700 text-blue-100'
                            : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-400'
                        }`}
                      >
                        {item.category}
                      </span>
                    </div>
                  );
                })
              )}
            </div>

            {/* Footer shortcuts helper */}
            <div className="px-4 py-2 border-t hairline bg-neutral-50/60 dark:bg-neutral-850/50 text-[10px] text-neutral-400 flex items-center justify-between">
              <span>
                Navigate with <kbd className="kbd">↑</kbd> <kbd className="kbd">↓</kbd>
              </span>
              <span>
                Select with <kbd className="kbd">Enter</kbd>
              </span>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
};

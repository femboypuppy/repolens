import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Star,
  Layers,
  GitCommitHorizontal,
  GitFork,
  GitCompare,
  FileDiff as FileDiffIcon,
} from 'lucide-react';
import type { DiffViewMode, GitBranch, Repository } from '../types';
import { gitService } from '../services/gitService';
import { OverviewTab } from './detail/OverviewTab';
import { CommitsTab } from './detail/CommitsTab';
import { RefsTab } from './detail/RefsTab';
import { ChangesTab } from './detail/ChangesTab';
import { CompareTab } from './detail/CompareTab';
import { FileHistoryModal } from './detail/FileHistoryModal';

export type DetailTabType = 'overview' | 'commits' | 'branches' | 'compare' | 'changes';

interface DetailPaneProps {
  repository: Repository | null;
  onClose: () => void;
  onToggleFavorite: (repoId: string, e: React.MouseEvent) => void;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
  width: number;
  onResizeStart: (e: React.MouseEvent) => void;
  diffMode: DiffViewMode;
  onDiffModeChange: (mode: DiffViewMode) => void;
}

export const DetailPane: React.FC<DetailPaneProps> = ({
  repository,
  onClose,
  onToggleFavorite,
  tags,
  onAddTag,
  onRemoveTag,
  width,
  onResizeStart,
  diffMode,
  onDiffModeChange,
}) => {
  const [activeTab, setActiveTab] = useState<DetailTabType>('overview');
  const [branches, setBranches] = useState<GitBranch[]>([]);
  const [blameFilePath, setBlameFilePath] = useState<string | null>(null);
  const [targetCommitHash, setTargetCommitHash] = useState<string | null>(null);

  useEffect(() => {
    if (!repository) return;
    gitService.getBranches(repository.path).then(setBranches).catch(() => setBranches([]));
  }, [repository]);

  if (!repository) return null;

  const tabs: { id: DetailTabType; label: string; icon: React.ReactNode; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: <Layers className="w-3.5 h-3.5" /> },
    { id: 'commits', label: 'Commits', icon: <GitCommitHorizontal className="w-3.5 h-3.5" /> },
    { id: 'branches', label: 'Branches', icon: <GitFork className="w-3.5 h-3.5" /> },
    { id: 'compare', label: 'Compare', icon: <GitCompare className="w-3.5 h-3.5" /> },
    {
      id: 'changes',
      label: 'Changes',
      icon: <FileDiffIcon className="w-3.5 h-3.5" />,
      badge: repository.totalChanges > 0 ? repository.totalChanges : undefined,
    },
  ];

  return (
    <aside
      style={{ width }}
      className="relative h-full flex flex-col border-l hairline bg-white dark:bg-neutral-900 select-none shrink-0 z-10"
      aria-label={`${repository.name} details`}
    >
      {/* Left resize handle */}
      <div
        onMouseDown={onResizeStart}
        className="absolute top-0 left-0 w-1.5 h-full cursor-col-resize hover:bg-blue-500/40 active:bg-blue-600 transition-colors z-20"
        title="Drag to resize detail pane"
        aria-hidden="true"
      />

      {/* Pane Header */}
      <div className="p-3.5 border-b hairline space-y-2.5">
        <div className="flex items-center justify-between gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-neutral-900 dark:text-neutral-100 truncate">
                {repository.name}
              </h2>
              <button
                type="button"
                onClick={(e) => onToggleFavorite(repository.id, e)}
                className="text-neutral-400 hover:text-amber-500 transition-colors p-0.5 rounded"
                title={repository.isFavorite ? 'Unfavorite' : 'Favorite'}
                aria-label={repository.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={`w-4 h-4 transition-transform active:scale-125 ${
                    repository.isFavorite ? 'fill-amber-500 text-amber-500' : ''
                  }`}
                />
              </button>
            </div>
            <p className="font-mono text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5 selectable">
              {repository.path}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            title="Close details (Esc)"
            aria-label="Close details"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Tab switcher */}
        <div className="flex items-center gap-1 border-b hairline -mb-3.5 pt-1" role="tablist">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                role="tab"
                aria-selected={isActive}
                onClick={() => setActiveTab(tab.id)}
                className={`relative flex items-center gap-1.5 px-3 py-2 text-xs font-medium transition-colors ${
                  isActive
                    ? 'text-blue-600 dark:text-blue-400 font-semibold'
                    : 'text-neutral-500 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200'
                }`}
              >
                {tab.icon}
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span className="chip bg-amber-500/15 text-amber-700 dark:text-amber-400 px-1 py-0 text-[10px]">
                    {tab.badge}
                  </span>
                )}
                {isActive && (
                  <motion.div
                    layoutId="detail-tab-indicator"
                    className="absolute bottom-0 left-0 right-0 h-0.5 bg-blue-600 dark:bg-blue-400 rounded-t"
                    transition={{ duration: 0.16, ease: 'easeInOut' }}
                  />
                )}
              </button>
            );
          })}
        </div>
      </div>

      {/* Pane Content */}
      <div className="flex-1 overflow-y-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.14 }}
            className="h-full"
          >
            {activeTab === 'overview' && (
              <OverviewTab
                repository={repository}
                tags={tags}
                onAddTag={onAddTag}
                onRemoveTag={onRemoveTag}
              />
            )}
            {activeTab === 'commits' && (
              <CommitsTab
                repository={repository}
                diffMode={diffMode}
                onDiffModeChange={onDiffModeChange}
                onOpenFileBlame={(p) => setBlameFilePath(p)}
                targetCommitHash={targetCommitHash}
              />
            )}
            {activeTab === 'branches' && (
              <RefsTab
                repository={repository}
                diffMode={diffMode}
                onDiffModeChange={onDiffModeChange}
              />
            )}
            {activeTab === 'compare' && (
              <CompareTab
                repository={repository}
                branches={branches}
                onSelectCommit={(hash) => {
                  setTargetCommitHash(hash);
                  setActiveTab('commits');
                }}
                onOpenFileBlame={(p) => setBlameFilePath(p)}
              />
            )}
            {activeTab === 'changes' && (
              <ChangesTab
                repository={repository}
                diffMode={diffMode}
                onDiffModeChange={onDiffModeChange}
                onOpenFileBlame={(p) => setBlameFilePath(p)}
              />
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      {blameFilePath && (
        <FileHistoryModal
          repoPath={repository.path}
          filePath={blameFilePath}
          onClose={() => setBlameFilePath(null)}
          onSelectCommit={(hash) => {
            setTargetCommitHash(hash);
            setActiveTab('commits');
          }}
        />
      )}
    </aside>
  );
};

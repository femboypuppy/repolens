import React from 'react';
import {
  GitBranch,
  Star,
  ArrowUp,
  ArrowDown,
  Clock,
  AlertCircle,
  FileCheck2,
  FolderGit2,
  AlertTriangle,
  Tag as TagIcon,
  Archive,
} from 'lucide-react';
import type { Repository } from '../types';
import { formatRelative } from '../utils/time';

interface RepositoryListProps {
  repositories: Repository[];
  selectedRepoId: string | null;
  onSelectRepo: (repo: Repository) => void;
  onToggleFavorite: (repoId: string, e: React.MouseEvent) => void;
  compactMode: boolean;
  searchQuery: string;
  onClearSearch: () => void;
  repoTags?: Record<string, string[]>;
  isLoading?: boolean;
}

export const RepositoryList: React.FC<RepositoryListProps> = ({
  repositories,
  selectedRepoId,
  onSelectRepo,
  onToggleFavorite,
  compactMode,
  searchQuery,
  onClearSearch,
  repoTags = {},
  isLoading = false,
}) => {
  if (isLoading && repositories.length === 0) {
    return (
      <div className="flex-1 overflow-y-auto divide-y hairline p-4 space-y-4" aria-busy="true">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="space-y-2 py-2">
            <div className="flex items-center gap-2">
              <div className="skeleton h-4 w-28" />
              <div className="skeleton h-4 w-16" />
            </div>
            <div className="skeleton h-3 w-48" />
            <div className="skeleton h-3 w-72" />
          </div>
        ))}
      </div>
    );
  }

  if (repositories.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        <FolderGit2 className="w-10 h-10 text-neutral-300 dark:text-neutral-700 mb-3" />
        <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">
          No repositories found
        </h3>
        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-sm">
          {searchQuery
            ? `No repositories match "${searchQuery}".`
            : 'No repositories in this category.'}
        </p>
        {searchQuery && (
          <button
            type="button"
            onClick={onClearSearch}
            className="mt-3 px-3 py-1.5 text-xs text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/40 rounded-md transition-colors"
          >
            Clear Search Filter
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className="flex-1 overflow-y-auto divide-y hairline select-none bg-white dark:bg-neutral-900"
      role="list"
      aria-label="Repositories"
    >
      {repositories.map((repo) => {
        const isSelected = repo.id === selectedRepoId;
        const tags = repoTags[repo.id] || [];

        return (
          <div
            key={repo.id}
            role="listitem"
            tabIndex={0}
            onClick={() => onSelectRepo(repo)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelectRepo(repo);
              }
            }}
            className={`group relative flex items-center justify-between transition-colors cursor-pointer outline-none focus-visible:ring-2 focus-visible:ring-blue-500/70 ${
              compactMode ? 'px-4 py-2' : 'px-4 py-3'
            } ${
              isSelected
                ? 'bg-blue-50/70 dark:bg-blue-950/30'
                : 'hover:bg-neutral-100/60 dark:hover:bg-neutral-850/60'
            } ${!repo.isAccessible ? 'opacity-70 bg-rose-50/20' : ''}`}
          >
            {/* Left selection bar */}
            {isSelected && (
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-blue-600 rounded-r" />
            )}

            {/* Main Details */}
            <div className="min-w-0 flex-1 pr-4 space-y-1">
              {/* Row 1: Name, Branch, Status, Ahead/Behind, Error */}
              <div className="flex items-center gap-2 flex-wrap">
                <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                  {repo.name}
                </span>

                {!repo.isAccessible ? (
                  <span className="chip bg-rose-100 dark:bg-rose-950 text-rose-700 dark:text-rose-300">
                    <AlertTriangle className="w-3 h-3 mr-0.5" /> inaccessible
                  </span>
                ) : (
                  <>
                    {/* Branch pill */}
                    <div
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono ${
                        repo.isDetached
                          ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                          : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                      }`}
                      title={repo.currentBranch}
                    >
                      <GitBranch className="w-3 h-3 shrink-0" />
                      <span className="truncate max-w-[140px]">
                        {repo.currentBranch || (repo.isUnborn ? 'unborn' : 'detached')}
                      </span>
                    </div>

                    {/* Status badge */}
                    {repo.status === 'clean' ? (
                      <span className="inline-flex items-center gap-1 text-[10.5px] font-medium text-emerald-600 dark:text-emerald-400">
                        <FileCheck2 className="w-3 h-3" />
                        <span>Clean</span>
                      </span>
                    ) : (
                      <div className="inline-flex items-center gap-1 text-[10.5px] font-medium text-amber-600 dark:text-amber-400">
                        <AlertCircle className="w-3 h-3" />
                        <span>{repo.totalChanges} changes</span>
                      </div>
                    )}

                    {/* Ahead / Behind or local-only badge */}
                    {repo.hasUpstream && (repo.aheadCount > 0 || repo.behindCount > 0) && (
                      <div className="inline-flex items-center gap-1.5 text-[10px] font-mono text-neutral-500 dark:text-neutral-400">
                        {repo.aheadCount > 0 && (
                          <span className="inline-flex items-center text-blue-600 dark:text-blue-400" title={`${repo.aheadCount} ahead of upstream`}>
                            <ArrowUp className="w-2.5 h-2.5" />
                            {repo.aheadCount}
                          </span>
                        )}
                        {repo.behindCount > 0 && (
                          <span className="inline-flex items-center text-rose-600 dark:text-rose-400" title={`${repo.behindCount} behind upstream`}>
                            <ArrowDown className="w-2.5 h-2.5" />
                            {repo.behindCount}
                          </span>
                        )}
                      </div>
                    )}

                    {!repo.hasUpstream && repo.localOnlyCommits > 0 && (
                      <span className="chip bg-amber-500/10 text-amber-700 dark:text-amber-400 text-[10px]" title="Commits not pushed to any remote">
                        {repo.localOnlyCommits} unpushed
                      </span>
                    )}

                    {/* Stash badge */}
                    {repo.stashCount > 0 && (
                      <span className="chip bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300 text-[10px]" title={`${repo.stashCount} stash(es)`}>
                        <Archive className="w-2.5 h-2.5 mr-0.5" />
                        {repo.stashCount}
                      </span>
                    )}

                    {/* User Tag Chips */}
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="chip bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400 text-[10px] font-mono"
                      >
                        <TagIcon className="w-2.5 h-2.5" />
                        {t}
                      </span>
                    ))}
                  </>
                )}
              </div>

              {/* Row 2: Location path or error message */}
              <div className="text-[11px] text-neutral-400 dark:text-neutral-500 truncate font-mono">
                {repo.errorMessage || repo.path}
              </div>

              {/* Row 3: Last commit subject & date */}
              {repo.lastCommit ? (
                <div className="flex items-center gap-2 text-[11px] text-neutral-600 dark:text-neutral-400 truncate">
                  <span className="truncate text-neutral-700 dark:text-neutral-300">
                    {repo.lastCommit.subject}
                  </span>
                  <span className="text-neutral-300 dark:text-neutral-700 shrink-0">•</span>
                  <div className="inline-flex items-center gap-1 text-[10px] text-neutral-400 shrink-0">
                    <Clock className="w-2.5 h-2.5" />
                    <span>{formatRelative(repo.lastCommit.date)}</span>
                  </div>
                </div>
              ) : (
                <div className="text-[11px] text-neutral-400 dark:text-neutral-500 italic">
                  {repo.isUnborn ? 'No commits yet' : '—'}
                </div>
              )}
            </div>

            {/* Right details: Change breakdown & Favorite star */}
            <div className="flex items-center gap-3 shrink-0">
              {repo.totalChanges > 0 && (
                <div className="hidden sm:flex items-center gap-1 font-mono text-[10px]">
                  {repo.stagedCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400"
                      title={`${repo.stagedCount} staged file(s)`}
                    >
                      +{repo.stagedCount}
                    </span>
                  )}
                  {repo.unstagedCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400"
                      title={`${repo.unstagedCount} modified file(s)`}
                    >
                      ~{repo.unstagedCount}
                    </span>
                  )}
                  {repo.untrackedCount > 0 && (
                    <span
                      className="px-1.5 py-0.5 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400"
                      title={`${repo.untrackedCount} untracked file(s)`}
                    >
                      ?{repo.untrackedCount}
                    </span>
                  )}
                </div>
              )}

              {/* Favorite Toggle Button */}
              <button
                type="button"
                onClick={(e) => onToggleFavorite(repo.id, e)}
                className={`p-1.5 rounded-full transition-transform active:scale-125 ${
                  repo.isFavorite
                    ? 'text-amber-500 hover:text-amber-600'
                    : 'text-neutral-300 dark:text-neutral-600 hover:text-amber-500 opacity-60 group-hover:opacity-100'
                }`}
                title={repo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                aria-label={repo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
              >
                <Star
                  className={`w-4 h-4 ${
                    repo.isFavorite ? 'fill-amber-500 text-amber-500' : ''
                  }`}
                />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
};

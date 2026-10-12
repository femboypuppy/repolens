import React from 'react';
import {
  GitBranch,
  Star,
  ArrowUp,
  ArrowDown,
  FileCheck2,
  AlertCircle,
  Code2,
  Terminal,
  FolderOpen,
  Clock,
} from 'lucide-react';
import type { Repository } from '../types';
import { formatRelative } from '../utils/time';

interface FleetOverviewProps {
  repositories: Repository[];
  selectedRepoId: string | null;
  onSelectRepo: (repo: Repository) => void;
  onToggleFavorite: (repoId: string, e: React.MouseEvent) => void;
  onOpenVsCode: (path: string, e: React.MouseEvent) => void;
  onOpenTerminal: (path: string, e: React.MouseEvent) => void;
  onOpenFileManager: (path: string, e: React.MouseEvent) => void;
}

export const FleetOverview: React.FC<FleetOverviewProps> = ({
  repositories,
  selectedRepoId,
  onSelectRepo,
  onToggleFavorite,
  onOpenVsCode,
  onOpenTerminal,
  onOpenFileManager,
}) => {
  if (repositories.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center text-neutral-400">
        No repositories available for fleet audit.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-auto select-none bg-white dark:bg-neutral-900">
      <table className="w-full border-collapse text-left text-xs">
        <thead className="sticky top-0 bg-neutral-100/90 dark:bg-neutral-850/90 backdrop-blur-xs border-b hairline text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider z-10">
          <tr>
            <th className="py-2.5 px-4 w-8"></th>
            <th className="py-2.5 px-4">Repository</th>
            <th className="py-2.5 px-4">Branch</th>
            <th className="py-2.5 px-4">Status</th>
            <th className="py-2.5 px-4">Changes</th>
            <th className="py-2.5 px-4">Upstream Sync</th>
            <th className="py-2.5 px-4">Last Commit</th>
            <th className="py-2.5 px-4 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y hairline">
          {repositories.map((repo) => {
            const isSelected = repo.id === selectedRepoId;

            return (
              <tr
                key={repo.id}
                onClick={() => onSelectRepo(repo)}
                className={`cursor-pointer transition-colors ${
                  isSelected
                    ? 'bg-blue-50/80 dark:bg-blue-950/30'
                    : 'hover:bg-neutral-50 dark:hover:bg-neutral-850/60'
                } ${!repo.isAccessible ? 'opacity-70 bg-rose-50/20' : ''}`}
              >
                {/* Favorite Star */}
                <td className="py-2.5 px-4">
                  <button
                    type="button"
                    onClick={(e) => onToggleFavorite(repo.id, e)}
                    className="text-neutral-300 dark:text-neutral-600 hover:text-amber-500 transition-colors p-0.5 rounded"
                    title={repo.isFavorite ? 'Unfavorite' : 'Favorite'}
                    aria-label={repo.isFavorite ? 'Remove from favorites' : 'Add to favorites'}
                  >
                    <Star
                      className={`w-3.5 h-3.5 ${
                        repo.isFavorite ? 'fill-amber-500 text-amber-500' : ''
                      }`}
                    />
                  </button>
                </td>

                {/* Name & Path */}
                <td className="py-2.5 px-4 min-w-[160px]">
                  <div className="font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-1.5">
                    <span>{repo.name}</span>
                    {!repo.isAccessible && (
                      <span className="chip bg-rose-100 text-rose-700 dark:bg-rose-900/40 dark:text-rose-300 text-[10px]">
                        inaccessible
                      </span>
                    )}
                  </div>
                  <div className="font-mono text-[10px] text-neutral-400 truncate max-w-[200px]">
                    {repo.path}
                  </div>
                </td>

                {/* Current Branch */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  <div
                    className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono ${
                      repo.isDetached
                        ? 'bg-amber-500/10 text-amber-700 dark:text-amber-400'
                        : 'bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
                    }`}
                  >
                    <GitBranch className="w-3 h-3 text-blue-500 shrink-0" />
                    <span>{repo.currentBranch || (repo.isUnborn ? 'unborn' : 'detached')}</span>
                  </div>
                </td>

                {/* Status */}
                <td className="py-2.5 px-4 whitespace-nowrap">
                  {repo.status === 'clean' ? (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                      <FileCheck2 className="w-3.5 h-3.5" />
                      <span>Clean</span>
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-[11px] font-medium text-amber-600 dark:text-amber-400">
                      <AlertCircle className="w-3.5 h-3.5" />
                      <span>{repo.totalChanges} changed</span>
                    </span>
                  )}
                </td>

                {/* Changes breakdown */}
                <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[10px]">
                  {repo.totalChanges > 0 ? (
                    <div className="flex items-center gap-1">
                      {repo.stagedCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400">
                          +{repo.stagedCount}
                        </span>
                      )}
                      {repo.unstagedCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-amber-500/10 text-amber-700 dark:text-amber-400">
                          ~{repo.unstagedCount}
                        </span>
                      )}
                      {repo.untrackedCount > 0 && (
                        <span className="px-1.5 py-0.2 rounded bg-neutral-200 dark:bg-neutral-800 text-neutral-600">
                          ?{repo.untrackedCount}
                        </span>
                      )}
                    </div>
                  ) : (
                    <span className="text-neutral-400">—</span>
                  )}
                </td>

                {/* Upstream Sync */}
                <td className="py-2.5 px-4 whitespace-nowrap font-mono text-[11px]">
                  {repo.hasUpstream ? (
                    repo.aheadCount === 0 && repo.behindCount === 0 ? (
                      <span className="text-neutral-400 font-sans text-[10px]">Up to date</span>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        {repo.aheadCount > 0 && (
                          <span className="inline-flex items-center text-blue-600 dark:text-blue-400">
                            <ArrowUp className="w-2.5 h-2.5" />
                            {repo.aheadCount}
                          </span>
                        )}
                        {repo.behindCount > 0 && (
                          <span className="inline-flex items-center text-rose-600 dark:text-rose-400">
                            <ArrowDown className="w-2.5 h-2.5" />
                            {repo.behindCount}
                          </span>
                        )}
                      </div>
                    )
                  ) : repo.localOnlyCommits > 0 ? (
                    <span className="text-amber-600 dark:text-amber-400 text-[10px]">
                      {repo.localOnlyCommits} unpushed
                    </span>
                  ) : (
                    <span className="text-neutral-400 text-[10px] italic">local</span>
                  )}
                </td>

                {/* Last Commit */}
                <td className="py-2.5 px-4 min-w-[200px] max-w-[280px]">
                  {repo.lastCommit ? (
                    <div className="truncate">
                      <p className="truncate text-neutral-800 dark:text-neutral-200 font-medium">
                        {repo.lastCommit.subject}
                      </p>
                      <p className="text-[10px] text-neutral-400 truncate flex items-center gap-1">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatRelative(repo.lastCommit.date)}</span>
                        <span>•</span>
                        <span>{repo.lastCommit.author}</span>
                      </p>
                    </div>
                  ) : (
                    <span className="text-neutral-400 italic text-[10px]">
                      {repo.isUnborn ? 'No commits' : '—'}
                    </span>
                  )}
                </td>

                {/* Action Launchers */}
                <td className="py-2.5 px-4 text-right whitespace-nowrap">
                  <div className="inline-flex items-center gap-1">
                    <button
                      type="button"
                      onClick={(e) => onOpenVsCode(repo.path, e)}
                      className="p-1 rounded text-neutral-400 hover:text-blue-600 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
                      title="Open in VS Code"
                      aria-label="Open in VS Code"
                    >
                      <Code2 className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => onOpenTerminal(repo.path, e)}
                      className="p-1 rounded text-neutral-400 hover:text-emerald-600 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
                      title="Open in Terminal"
                      aria-label="Open in Terminal"
                    >
                      <Terminal className="w-3.5 h-3.5" />
                    </button>

                    <button
                      type="button"
                      onClick={(e) => onOpenFileManager(repo.path, e)}
                      className="p-1 rounded text-neutral-400 hover:text-amber-600 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 transition-colors"
                      title="Reveal in File Explorer"
                      aria-label="Reveal in File Explorer"
                    >
                      <FolderOpen className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

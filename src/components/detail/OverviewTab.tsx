import React, { useState } from 'react';
import {
  GitBranch,
  Copy,
  Check,
  FolderOpen,
  Code2,
  Terminal,
  Clock,
  User,
  Tag as TagIcon,
  Plus,
  X,
  ArrowUp,
  ArrowDown,
  Cloud,
  FileCheck2,
  AlertCircle,
  Archive,
} from 'lucide-react';
import type { Repository } from '../../types';
import { gitService } from '../../services/gitService';
import { formatAbsolute, formatRelative } from '../../utils/time';
import { CopyButton } from './CommitDetail';

interface OverviewTabProps {
  repository: Repository;
  tags: string[];
  onAddTag: (tag: string) => void;
  onRemoveTag: (tag: string) => void;
}

export const OverviewTab: React.FC<OverviewTabProps> = ({
  repository,
  tags,
  onAddTag,
  onRemoveTag,
}) => {
  const [newTagInput, setNewTagInput] = useState('');
  const [isAddingTag, setIsAddingTag] = useState(false);
  const [copiedPath, setCopiedPath] = useState(false);

  const handleCopyPath = async () => {
    try {
      await navigator.clipboard.writeText(repository.path);
      setCopiedPath(true);
      setTimeout(() => setCopiedPath(false), 2000);
    } catch {
      // fallback
    }
  };

  const handleAddTagSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newTagInput.trim().toLowerCase();
    if (trimmed && !tags.includes(trimmed)) {
      onAddTag(trimmed);
      setNewTagInput('');
      setIsAddingTag(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Quick Launch Action Bar */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={handleCopyPath}
          className="btn"
          title="Copy repository path to clipboard"
        >
          {copiedPath ? (
            <Check className="w-3.5 h-3.5 text-emerald-500" />
          ) : (
            <Copy className="w-3.5 h-3.5 text-neutral-500" />
          )}
          <span>{copiedPath ? 'Copied' : 'Copy Path'}</span>
        </button>

        <button
          type="button"
          onClick={() => gitService.openInFileManager(repository.path)}
          className="btn"
          title="Reveal in OS file manager"
        >
          <FolderOpen className="w-3.5 h-3.5 text-neutral-500" />
          <span>Files</span>
        </button>

        <button
          type="button"
          onClick={() => gitService.openInVsCode(repository.path)}
          className="btn"
          title="Open in Visual Studio Code"
        >
          <Code2 className="w-3.5 h-3.5 text-blue-500" />
          <span>VS Code</span>
        </button>

        <button
          type="button"
          onClick={() => gitService.openInTerminal(repository.path)}
          className="btn"
          title="Open in Terminal"
        >
          <Terminal className="w-3.5 h-3.5 text-emerald-500" />
          <span>Terminal</span>
        </button>
      </div>

      {/* Repository Location & Status Card */}
      <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">Location</span>
          <span className="font-mono text-[11px] text-neutral-800 dark:text-neutral-200 truncate max-w-[280px] selectable" title={repository.path}>
            {repository.path}
          </span>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">Current Branch</span>
          <div className="flex items-center gap-1.5 font-mono">
            <GitBranch className="w-3.5 h-3.5 text-blue-500" />
            <span className={`font-medium ${repository.isDetached ? 'text-amber-600 dark:text-amber-400' : 'text-neutral-800 dark:text-neutral-200'}`}>
              {repository.currentBranch || (repository.isUnborn ? 'unborn (no commits)' : 'detached')}
            </span>
          </div>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">Working Tree</span>
          <div className="flex items-center gap-1.5">
            {repository.status === 'clean' ? (
              <span className="inline-flex items-center gap-1 font-medium text-emerald-600 dark:text-emerald-400">
                <FileCheck2 className="w-3.5 h-3.5" />
                <span>Clean</span>
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400">
                <AlertCircle className="w-3.5 h-3.5" />
                <span>{repository.totalChanges} modified file{repository.totalChanges === 1 ? '' : 's'}</span>
              </span>
            )}
          </div>
        </div>

        {/* Sync / Upstream state */}
        <div className="flex items-center justify-between pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
          <span className="text-neutral-500 dark:text-neutral-400 font-medium">Tracking Upstream</span>
          <div className="font-mono text-[11px]">
            {repository.hasUpstream ? (
              <div className="flex items-center gap-2">
                <span className="text-neutral-700 dark:text-neutral-300">{repository.upstreamBranch}</span>
                {repository.aheadCount === 0 && repository.behindCount === 0 ? (
                  <span className="chip bg-neutral-200 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-400">in sync</span>
                ) : (
                  <div className="inline-flex items-center gap-1.5">
                    {repository.aheadCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-blue-600 dark:text-blue-400">
                        <ArrowUp className="w-3 h-3" />
                        {repository.aheadCount}
                      </span>
                    )}
                    {repository.behindCount > 0 && (
                      <span className="inline-flex items-center gap-0.5 text-rose-600 dark:text-rose-400">
                        <ArrowDown className="w-3 h-3" />
                        {repository.behindCount}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ) : repository.localOnlyCommits > 0 ? (
              <span className="text-amber-600 dark:text-amber-400">
                {repository.localOnlyCommits} local commit{repository.localOnlyCommits === 1 ? '' : 's'} (unpushed)
              </span>
            ) : (
              <span className="italic text-neutral-400">No upstream tracking branch</span>
            )}
          </div>
        </div>

        {/* Stash & Conflict badges if any */}
        {(repository.stashCount > 0 || repository.conflictedCount > 0) && (
          <div className="flex items-center gap-2 pt-2 border-t border-neutral-200/60 dark:border-neutral-800/60">
            {repository.stashCount > 0 && (
              <span className="chip bg-violet-50 dark:bg-violet-500/15 text-violet-700 dark:text-violet-300">
                <Archive className="w-3 h-3 mr-1" />
                {repository.stashCount} stash{repository.stashCount === 1 ? '' : 'es'}
              </span>
            )}
            {repository.conflictedCount > 0 && (
              <span className="chip bg-rose-100 dark:bg-rose-900/40 text-rose-700 dark:text-rose-300">
                <AlertCircle className="w-3 h-3 mr-1" />
                {repository.conflictedCount} merge conflict{repository.conflictedCount === 1 ? '' : 's'}
              </span>
            )}
          </div>
        )}
      </div>

      {/* Repo Tags (User labels) */}
      <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1.5 section-label">
            <TagIcon className="w-3 h-3 text-neutral-400" />
            <span>Repository Tags</span>
          </div>
          {!isAddingTag && (
            <button
              type="button"
              onClick={() => setIsAddingTag(true)}
              className="inline-flex items-center gap-1 text-[11px] text-blue-600 dark:text-blue-400 hover:underline"
            >
              <Plus className="w-3 h-3" />
              <span>Add tag</span>
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          {tags.length === 0 && !isAddingTag ? (
            <p className="text-[11px] text-neutral-400 italic">No tags assigned. Tag repositories to organize them in the sidebar.</p>
          ) : (
            tags.map((t) => (
              <span
                key={t}
                className="chip bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-mono text-[11px] pr-1"
              >
                <span>{t}</span>
                <button
                  type="button"
                  onClick={() => onRemoveTag(t)}
                  className="hover:text-rose-500 p-0.5 rounded transition-colors"
                  aria-label={`Remove tag ${t}`}
                >
                  <X className="w-2.5 h-2.5" />
                </button>
              </span>
            ))
          )}

          {isAddingTag && (
            <form onSubmit={handleAddTagSubmit} className="inline-flex items-center gap-1">
              <input
                type="text"
                autoFocus
                value={newTagInput}
                onChange={(e) => setNewTagInput(e.target.value)}
                placeholder="tag name"
                className="input h-6 px-1.5 text-xs font-mono w-24"
              />
              <button type="submit" className="btn h-6 px-2 text-[10px]">
                Add
              </button>
              <button
                type="button"
                onClick={() => {
                  setIsAddingTag(false);
                  setNewTagInput('');
                }}
                className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200 p-1"
              >
                <X className="w-3 h-3" />
              </button>
            </form>
          )}
        </div>
      </div>

      {/* Latest Commit Card */}
      <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 space-y-2">
        <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-400 dark:text-neutral-500 uppercase tracking-wider">
          <span>Latest Commit</span>
          {repository.lastCommit && (
            <CopyButton
              value={repository.lastCommit.hash}
              label="Copy commit hash"
              display={repository.lastCommit.shortHash}
            />
          )}
        </div>

        {repository.lastCommit ? (
          <div className="space-y-1.5">
            <p className="font-medium text-neutral-900 dark:text-neutral-100 text-xs selectable leading-relaxed">
              {repository.lastCommit.subject}
            </p>
            <div className="flex flex-wrap items-center gap-3 text-[11px] text-neutral-500 dark:text-neutral-400 pt-0.5">
              <span className="flex items-center gap-1">
                <User className="w-3 h-3" />
                {repository.lastCommit.author}
              </span>
              <span
                className="flex items-center gap-1"
                title={formatAbsolute(repository.lastCommit.date)}
              >
                <Clock className="w-3 h-3" />
                {formatRelative(repository.lastCommit.date)}
              </span>
            </div>
          </div>
        ) : (
          <p className="text-neutral-400 italic text-[11px]">No commits in repository</p>
        )}
      </div>

      {/* Configured Remotes */}
      <div className="p-3.5 rounded-lg border border-neutral-200 dark:border-neutral-800 bg-neutral-50/60 dark:bg-neutral-850/50 space-y-2">
        <div className="flex items-center gap-1.5 section-label">
          <Cloud className="w-3 h-3 text-neutral-400" />
          <span>Configured Remotes</span>
        </div>
        {repository.remotes.length === 0 ? (
          <p className="text-neutral-400 italic text-[11px]">No remote repositories configured.</p>
        ) : (
          <div className="space-y-1.5 font-mono text-[11px]">
            {repository.remotes.map((rem, idx) => (
              <div
                key={idx}
                className="flex items-center justify-between text-neutral-700 dark:text-neutral-300 gap-2"
              >
                <div className="flex items-center gap-1.5 min-w-0">
                  <span className="text-blue-600 dark:text-blue-400 font-semibold">{rem.name}</span>
                  <span className="text-[10px] text-neutral-400 uppercase">({rem.direction})</span>
                </div>
                <span className="truncate max-w-[240px] text-neutral-500 selectable" title={rem.url}>
                  {rem.url}
                </span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

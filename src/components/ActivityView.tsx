import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  Calendar,
  Check,
  Copy,
  FolderGit2,
  Clock,
  Sparkles,
  RotateCw,
  GitCommit as CommitIcon,
} from 'lucide-react';
import type { GitCommit, Repository } from '../types';
import { gitService } from '../services/gitService';
import { dayKey, formatDayHeading, formatRelative } from '../utils/time';

interface ActivityViewProps {
  repositories: Repository[];
  onSelectRepo: (repo: Repository) => void;
}

interface RepoCommitItem {
  repoName: string;
  repoPath: string;
  commit: GitCommit;
}

const TIMEFRAMES = [
  { days: 1, label: 'Today (24h)' },
  { days: 3, label: 'Last 3 days' },
  { days: 7, label: 'Last 7 days' },
  { days: 14, label: 'Last 14 days' },
  { days: 30, label: 'Last 30 days' },
];

export const ActivityView: React.FC<ActivityViewProps> = ({
  repositories,
  onSelectRepo,
}) => {
  const [days, setDays] = useState(7);
  // Store all loaded 30-day commits so switching timeframe tabs is instantaneous (0ms) without lag
  const [allCommits, setAllCommits] = useState<RepoCommitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [copiedHash, setCopiedHash] = useState<string | null>(null);
  const [copiedMd, setCopiedMd] = useState(false);

  // Load maximum timeframe (30 days) of commits once
  const loadActivity = useCallback(async (isManualRefresh = false) => {
    if (isManualRefresh) {
      setIsRefreshing(true);
    } else {
      setLoading(true);
    }

    const results: RepoCommitItem[] = [];

    await Promise.all(
      repositories.map(async (repo) => {
        if (!repo.isAccessible || repo.isUnborn) return;
        try {
          // Always fetch 30 days into memory so clicking 1d, 3d, 7d, 14d, 30d is 0ms instant
          const commits = await gitService.getMyCommits(repo.path, 30);
          for (const c of commits) {
            results.push({
              repoName: repo.name,
              repoPath: repo.path,
              commit: c,
            });
          }
        } catch (e) {
          console.warn(`Could not get activity for ${repo.name}:`, e);
        }
      })
    );

    // Sort descending by commit date
    results.sort(
      (a, b) => new Date(b.commit.date).getTime() - new Date(a.commit.date).getTime()
    );

    setAllCommits(results);
    setLoading(false);
    setIsRefreshing(false);
  }, [repositories]);

  useEffect(() => {
    loadActivity();
  }, [loadActivity]);

  // Instant in-memory filter based on the active timeframe (0ms latency, zero button lag)
  const items = useMemo(() => {
    const cutoff = Date.now() - days * 24 * 3600 * 1000;
    return allCommits.filter((item) => new Date(item.commit.date).getTime() >= cutoff);
  }, [allCommits, days]);

  // Group items by calendar day
  const groupedByDay = useMemo(() => {
    const groups: { heading: string; items: RepoCommitItem[] }[] = [];
    const map = new Map<string, RepoCommitItem[]>();

    for (const item of items) {
      const key = dayKey(item.commit.date);
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
        // CRITICAL BUGFIX: formatDayHeading expects the day key (e.g. "2026-10-12"), not the raw ISO string
        groups.push({ heading: formatDayHeading(key), items: list });
      }
      list.push(item);
    }

    return groups;
  }, [items]);

  // Copy commit hash helper
  const handleCopyHash = async (hash: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await navigator.clipboard.writeText(hash);
      setCopiedHash(hash);
      setTimeout(() => setCopiedHash(null), 1500);
    } catch {
      // ignore
    }
  };

  // Export to Markdown for standups / changelogs
  const handleCopyMarkdown = async () => {
    if (groupedByDay.length === 0) return;

    let md = `# Activity Summary (${days} days)\n\n`;
    for (const group of groupedByDay) {
      md += `### ${group.heading}\n`;
      for (const item of group.items) {
        md += `- **${item.repoName}**: ${item.commit.subject} (\`${item.commit.shortHash}\`)\n`;
      }
      md += '\n';
    }

    try {
      await navigator.clipboard.writeText(md.trim());
      setCopiedMd(true);
      setTimeout(() => setCopiedMd(false), 2000);
    } catch {
      // fallback
    }
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-[#0c1017] select-none overflow-hidden">
      {/* View Header / Controls */}
      <div className="flex items-center justify-between px-6 py-3.5 border-b hairline bg-neutral-50/50 dark:bg-[#111723]/60 shrink-0">
        <div>
          <h2 className="text-sm font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Activity Summary</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            What did you work on across your local repositories?
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          {/* Timeframe selector: optimistic instant switch */}
          <div className="segmented" role="group" aria-label="Timeframe selection">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.days}
                type="button"
                aria-pressed={days === tf.days}
                onClick={() => setDays(tf.days)}
                className="cursor-pointer"
              >
                {tf.label}
              </button>
            ))}
          </div>

          {/* Refresh button */}
          <button
            type="button"
            onClick={() => loadActivity(true)}
            disabled={isRefreshing}
            className="icon-btn cursor-pointer"
            title="Refresh commit activity"
          >
            <RotateCw className={`w-3.5 h-3.5 ${isRefreshing ? 'animate-spin text-blue-500' : ''}`} />
          </button>

          {/* Copy Markdown button */}
          <button
            type="button"
            onClick={handleCopyMarkdown}
            disabled={items.length === 0}
            className="btn cursor-pointer"
            title="Copy activity report as Markdown (useful for standup notes)"
          >
            {copiedMd ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-neutral-400" />
            )}
            <span>{copiedMd ? 'Copied' : 'Copy as Markdown'}</span>
          </button>
        </div>
      </div>

      {/* Activity Timeline Content */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {loading ? (
          <div className="space-y-4 max-w-2xl mx-auto py-8" aria-busy="true">
            {[60, 80, 50, 70].map((w, i) => (
              <div key={i} className="space-y-2">
                <div className="skeleton h-4 w-32" />
                <div className="skeleton h-12" style={{ width: `${w}%` }} />
              </div>
            ))}
          </div>
        ) : groupedByDay.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-400">
            <Calendar className="w-10 h-10 mb-3 opacity-60 text-neutral-400" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No matching activity found
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              No commits authored with your configured Git email were found in the last {days} days across {repositories.length} repositories.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {groupedByDay.map((group) => (
              <div key={group.heading} className="space-y-2.5">
                {/* Clean, fixed day heading */}
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-600 dark:text-neutral-300 sticky top-0 bg-white/95 dark:bg-[#0c1017]/95 py-1.5 backdrop-blur-xs z-10">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>{group.heading}</span>
                  <span className="chip bg-neutral-100 dark:bg-[#161d2d] text-neutral-500 dark:text-neutral-400 text-[10.5px]">
                    {group.items.length} commit{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                {/* Day commits list */}
                <div className="space-y-2 pl-2 border-l-2 border-blue-500/20 dark:border-blue-500/20 ml-1.5">
                  {group.items.map((item) => {
                    const repoObj = repositories.find((r) => r.path === item.repoPath);
                    const isHashCopied = copiedHash === item.commit.hash;

                    return (
                      <div
                        key={`${item.repoPath}-${item.commit.hash}`}
                        onClick={() => repoObj && onSelectRepo(repoObj)}
                        className="group flex items-start justify-between gap-3 p-3 rounded-lg border hairline bg-white dark:bg-[#121825] hover:bg-neutral-50/80 dark:hover:bg-[#161e2e] hover:border-blue-500/30 transition-all cursor-pointer shadow-2xs"
                      >
                        <div className="min-w-0 flex-1 space-y-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="chip bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300 font-medium">
                              <FolderGit2 className="w-3 h-3 text-blue-500" />
                              <span>{item.repoName}</span>
                            </span>

                            <button
                              type="button"
                              onClick={(e) => handleCopyHash(item.commit.hash, e)}
                              className="inline-flex items-center gap-1 font-mono text-[10.5px] px-1.5 py-0.5 rounded bg-neutral-100 dark:bg-[#1a2336] text-neutral-500 hover:text-neutral-800 dark:text-neutral-400 dark:hover:text-neutral-200 transition-colors"
                              title="Click to copy full commit hash"
                            >
                              <CommitIcon className="w-3 h-3 text-neutral-400" />
                              <span>{item.commit.shortHash}</span>
                              {isHashCopied && (
                                <Check className="w-2.5 h-2.5 text-emerald-500" />
                              )}
                            </button>
                          </div>

                          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 selectable leading-relaxed">
                            {item.commit.subject}
                          </p>
                        </div>

                        <div className="flex items-center gap-1.5 text-[11px] text-neutral-400 shrink-0 pt-0.5">
                          <Clock className="w-3 h-3" />
                          <span>{formatRelative(item.commit.date)}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

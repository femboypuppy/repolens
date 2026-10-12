import React, { useEffect, useMemo, useState } from 'react';
import {
  Calendar,
  Check,
  Copy,
  FolderGit2,
  Clock,
  Sparkles,
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
  const [items, setItems] = useState<RepoCommitItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [copiedMd, setCopiedMd] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);

    const loadActivity = async () => {
      const results: RepoCommitItem[] = [];

      await Promise.all(
        repositories.map(async (repo) => {
          if (!repo.isAccessible || repo.isUnborn) return;
          try {
            const commits = await gitService.getMyCommits(repo.path, days);
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

      if (!cancelled) {
        // Sort descending by commit date
        results.sort(
          (a, b) => new Date(b.commit.date).getTime() - new Date(a.commit.date).getTime()
        );
        setItems(results);
        setLoading(false);
      }
    };

    loadActivity();

    return () => {
      cancelled = true;
    };
  }, [repositories, days]);

  // Group items by day
  const groupedByDay = useMemo(() => {
    const groups: { heading: string; items: RepoCommitItem[] }[] = [];
    const map = new Map<string, RepoCommitItem[]>();

    for (const item of items) {
      const key = dayKey(item.commit.date);
      let list = map.get(key);
      if (!list) {
        list = [];
        map.set(key, list);
        groups.push({ heading: formatDayHeading(item.commit.date), items: list });
      }
      list.push(item);
    }

    return groups;
  }, [items]);

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
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-neutral-900 select-none overflow-hidden">
      {/* View Header / Controls */}
      <div className="flex items-center justify-between px-6 py-4 border-b hairline">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-blue-500" />
            <span>Activity Summary</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            What did you work on across your local repositories?
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <div className="segmented" role="group" aria-label="Timeframe selection">
            {TIMEFRAMES.map((tf) => (
              <button
                key={tf.days}
                type="button"
                aria-pressed={days === tf.days}
                onClick={() => setDays(tf.days)}
              >
                {tf.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={handleCopyMarkdown}
            disabled={items.length === 0}
            className="btn"
            title="Copy activity report as Markdown (useful for standup notes)"
          >
            {copiedMd ? (
              <Check className="w-3.5 h-3.5 text-emerald-500" />
            ) : (
              <Copy className="w-3.5 h-3.5 text-neutral-500" />
            )}
            <span>{copiedMd ? 'Copied Markdown' : 'Copy as Markdown'}</span>
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
              No commits authored with your configured email were found in the last {days} days across {repositories.length} repositories.
            </p>
          </div>
        ) : (
          <div className="max-w-3xl mx-auto space-y-6">
            {groupedByDay.map((group) => (
              <div key={group.heading} className="space-y-2">
                <div className="flex items-center gap-2 text-xs font-semibold text-neutral-500 dark:text-neutral-400 sticky top-0 bg-white/90 dark:bg-neutral-900/90 py-1 backdrop-blur-xs z-10">
                  <Calendar className="w-3.5 h-3.5 text-blue-500" />
                  <span>{group.heading}</span>
                  <span className="chip bg-neutral-100 dark:bg-neutral-800 text-neutral-500">
                    {group.items.length} commit{group.items.length === 1 ? '' : 's'}
                  </span>
                </div>

                <div className="space-y-1.5 pl-2 border-l border-neutral-200 dark:border-neutral-800 ml-1.5">
                  {group.items.map((item) => {
                    const repoObj = repositories.find((r) => r.path === item.repoPath);
                    return (
                      <div
                        key={`${item.repoPath}-${item.commit.hash}`}
                        className="group flex items-start justify-between gap-3 p-2.5 rounded-lg border hairline hover:bg-neutral-50 dark:hover:bg-neutral-850/60 transition-colors"
                      >
                        <div className="min-w-0 flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => repoObj && onSelectRepo(repoObj)}
                              className="chip bg-blue-50 hover:bg-blue-100 dark:bg-blue-500/15 dark:hover:bg-blue-500/25 text-blue-700 dark:text-blue-300 transition-colors cursor-pointer"
                              title={`Jump to repository: ${item.repoName}`}
                            >
                              <FolderGit2 className="w-3 h-3" />
                              <span className="font-semibold">{item.repoName}</span>
                            </button>
                            <span className="font-mono text-[10.5px] text-neutral-400">
                              {item.commit.shortHash}
                            </span>
                          </div>

                          <p className="text-xs font-medium text-neutral-800 dark:text-neutral-200 selectable">
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

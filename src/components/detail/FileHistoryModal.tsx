import { useEffect, useState } from 'react';
import type { BlameLine, GitCommit, FileDiff } from '../../types';
import { gitService } from '../../services/gitService';
import { formatRelative } from '../../utils/time';
import { DiffViewer } from '../DiffViewer';

interface FileHistoryModalProps {
  repoPath: string;
  filePath: string;
  onClose: () => void;
  onSelectCommit?: (hash: string) => void;
}

export function FileHistoryModal({
  repoPath,
  filePath,
  onClose,
  onSelectCommit,
}: FileHistoryModalProps) {
  const [tab, setTab] = useState<'blame' | 'history'>('blame');
  const [blameLines, setBlameLines] = useState<BlameLine[]>([]);
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // For history commit selection diff preview
  const [selectedCommitHash, setSelectedCommitHash] = useState<string | null>(null);
  const [commitFileDiff, setCommitFileDiff] = useState<FileDiff | null>(null);
  const [diffLoading, setDiffLoading] = useState<boolean>(false);

  // Active hover/selected blame line
  const [activeBlameLine, setActiveBlameLine] = useState<BlameLine | null>(null);

  // Close on Escape
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Load blame and history data
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);

    Promise.all([
      gitService.getFileBlame(repoPath, filePath),
      gitService.getFileHistory(repoPath, filePath, 50),
    ])
      .then(([blameData, historyData]) => {
        if (!active) return;
        setBlameLines(blameData);
        setCommits(historyData);
        setLoading(false);
        if (historyData.length > 0) {
          setSelectedCommitHash(historyData[0].hash);
        }
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [repoPath, filePath]);

  // When a commit is selected in history tab, load its diff for this file
  useEffect(() => {
    if (!selectedCommitHash || tab !== 'history') return;
    let active = true;
    setDiffLoading(true);

    gitService
      .getCommitDiff(repoPath, selectedCommitHash)
      .then((cDiff) => {
        if (!active) return;
        const matched = cDiff.files.find((f) => f.path === filePath || f.oldPath === filePath);
        setCommitFileDiff(matched || cDiff.files[0] || null);
        setDiffLoading(false);
      })
      .catch(() => {
        if (active) setDiffLoading(false);
      });

    return () => {
      active = false;
    };
  }, [repoPath, selectedCommitHash, filePath, tab]);

  // Compute age heatmap color warmth: based on days ago
  const nowSecs = Math.floor(Date.now() / 1000);
  const getAgeWarmth = (timestamp: number) => {
    const days = (nowSecs - timestamp) / 86400;
    if (days < 7) {
      return 'border-l-2 border-emerald-500 bg-emerald-500/5 text-emerald-700 dark:text-emerald-400';
    }
    if (days < 30) {
      return 'border-l-2 border-teal-500 bg-teal-500/5 text-teal-700 dark:text-teal-400';
    }
    if (days < 90) {
      return 'border-l-2 border-sky-500 bg-sky-500/5 text-sky-700 dark:text-sky-400';
    }
    if (days < 365) {
      return 'border-l-2 border-indigo-400/40 text-neutral-600 dark:text-neutral-400';
    }
    return 'border-l-2 border-neutral-300 dark:border-neutral-700 text-neutral-400 dark:text-neutral-500';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
      <div className="flex flex-col w-full max-w-5xl h-[85vh] bg-white dark:bg-neutral-900 rounded-xl shadow-2xl border border-neutral-200 dark:border-neutral-800 overflow-hidden">
        {/* Header */}
        <div className="p-3.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-3 bg-neutral-50/70 dark:bg-neutral-900/60">
          <div className="flex items-center gap-2 min-w-0">
            <span className="p-1 rounded bg-accent-500/10 text-accent-600 dark:text-accent-400 font-mono text-xs">
              File
            </span>
            <span className="font-mono text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate">
              {filePath}
            </span>
          </div>

          <div className="flex items-center gap-2">
            {/* Tab switch */}
            <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-700 overflow-hidden text-xs">
              <button
                type="button"
                onClick={() => setTab('blame')}
                className={`px-3 py-1 font-medium transition-colors ${
                  tab === 'blame'
                    ? 'bg-accent-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                Line-by-Line Blame
              </button>
              <button
                type="button"
                onClick={() => setTab('history')}
                className={`px-3 py-1 font-medium transition-colors ${
                  tab === 'history'
                    ? 'bg-accent-600 text-white'
                    : 'bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700'
                }`}
              >
                Revision History ({commits.length})
              </button>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="p-1 text-neutral-400 hover:text-neutral-700 dark:hover:text-neutral-200 rounded transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>

        {/* Content body */}
        <div className="flex-1 overflow-hidden flex flex-col">
          {loading ? (
            <div className="flex-1 flex items-center justify-center text-xs text-neutral-400">
              Loading {filePath}...
            </div>
          ) : error ? (
            <div className="p-4 m-4 rounded border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs">
              {error}
            </div>
          ) : tab === 'blame' ? (
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Heatmap Legend */}
              <div className="px-3 py-1.5 border-b border-neutral-100 dark:border-neutral-800/80 bg-neutral-50/40 dark:bg-neutral-900/30 flex items-center gap-3 text-[11px] text-neutral-500">
                <span className="font-medium">Age Heatmap:</span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-emerald-500" /> &lt; 7 days
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-teal-500" /> &lt; 30 days
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-sky-500" /> &lt; 90 days
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2.5 h-2.5 rounded-sm bg-neutral-400" /> Older
                </span>
                {activeBlameLine && (
                  <div className="ml-auto flex items-center gap-2 text-xs">
                    <span className="font-mono text-accent-600 dark:text-accent-400">
                      {activeBlameLine.commitHash.slice(0, 7)}
                    </span>
                    <span className="font-medium text-neutral-700 dark:text-neutral-300">
                      {activeBlameLine.author}:
                    </span>
                    <span className="text-neutral-500 truncate max-w-sm">
                      {activeBlameLine.summary}
                    </span>
                    {onSelectCommit && (
                      <button
                        type="button"
                        onClick={() => {
                          onSelectCommit(activeBlameLine.commitHash);
                          onClose();
                        }}
                        className="px-2 py-0.5 rounded bg-accent-50 dark:bg-accent-950/40 text-accent-600 dark:text-accent-400 text-[11px] font-semibold hover:underline"
                      >
                        Inspect Commit
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Blame rows */}
              <div className="flex-1 overflow-auto font-mono text-xs select-text">
                <table className="w-full border-collapse">
                  <tbody>
                    {blameLines.map((line) => {
                      const warmthClass = getAgeWarmth(line.timestamp);
                      const isHovered = activeBlameLine?.lineNumber === line.lineNumber;
                      return (
                        <tr
                          key={line.lineNumber}
                          onMouseEnter={() => setActiveBlameLine(line)}
                          className={`transition-colors ${
                            isHovered
                              ? 'bg-accent-50/60 dark:bg-accent-950/30'
                              : 'hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40'
                          }`}
                        >
                          {/* Line Number */}
                          <td className="w-12 px-2 py-0.5 text-right text-neutral-400 dark:text-neutral-600 select-none border-r border-neutral-100 dark:border-neutral-800/60">
                            {line.lineNumber}
                          </td>
                          {/* Commit Chip & Author */}
                          <td
                            className={`w-56 px-2 py-0.5 text-[11px] truncate whitespace-nowrap select-none ${warmthClass}`}
                            title={`${line.author} • ${formatRelative(new Date(line.timestamp * 1000).toISOString())}\n${line.commitHash}\n${line.summary}`}
                          >
                            <span className="font-semibold text-neutral-700 dark:text-neutral-300 mr-2">
                              {line.author}
                            </span>
                            <span className="text-[10px] text-neutral-400">
                              {formatRelative(new Date(line.timestamp * 1000).toISOString())}
                            </span>
                          </td>
                          {/* Line Code Content */}
                          <td className="px-3 py-0.5 whitespace-pre font-mono text-neutral-900 dark:text-neutral-200">
                            {line.content || ' '}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* History Tab */
            <div className="flex-1 flex overflow-hidden">
              {/* Revision commits list */}
              <div className="w-80 border-r border-neutral-200 dark:border-neutral-800 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60 shrink-0">
                {commits.map((c) => (
                  <div
                    key={c.hash}
                    onClick={() => setSelectedCommitHash(c.hash)}
                    className={`p-3 text-xs cursor-pointer transition-colors ${
                      selectedCommitHash === c.hash
                        ? 'bg-accent-50/80 dark:bg-accent-950/30 border-l-2 border-accent-500 font-medium'
                        : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-1 text-[11px] text-neutral-400 mb-1">
                      <span className="font-mono text-accent-600 dark:text-accent-400">{c.shortHash}</span>
                      <span>{formatRelative(c.date)}</span>
                    </div>
                    <div className="font-medium text-neutral-800 dark:text-neutral-200 line-clamp-2">
                      {c.subject}
                    </div>
                    <div className="text-[11px] text-neutral-500 mt-1">
                      {c.author}
                    </div>
                  </div>
                ))}
              </div>

              {/* Commit Diff Pane */}
              <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
                <div className="p-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between bg-neutral-50/40 dark:bg-neutral-900/40 text-xs">
                  <span className="font-medium text-neutral-700 dark:text-neutral-300">
                    Changes in {selectedCommitHash?.slice(0, 7)}
                  </span>
                  {selectedCommitHash && onSelectCommit && (
                    <button
                      type="button"
                      onClick={() => {
                        onSelectCommit(selectedCommitHash);
                        onClose();
                      }}
                      className="px-2 py-1 rounded bg-accent-600 text-white font-medium hover:bg-accent-700 transition-colors"
                    >
                      View in Commit Graph
                    </button>
                  )}
                </div>
                <div className="flex-1 overflow-auto">
                  {diffLoading ? (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                      Loading revision diff...
                    </div>
                  ) : commitFileDiff ? (
                    <DiffViewer diff={commitFileDiff} mode="unified" />
                  ) : (
                    <div className="h-full flex items-center justify-center text-xs text-neutral-400">
                      No diff available for this commit.
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

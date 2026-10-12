import { useEffect, useState, useTransition } from 'react';
import type { GitBranch, Repository, BranchComparison, FileDiff } from '../../types';
import { gitService } from '../../services/gitService';
import { DiffViewer } from '../DiffViewer';
import { formatRelative } from '../../utils/time';

interface CompareTabProps {
  repository: Repository;
  branches: GitBranch[];
  onSelectCommit?: (hash: string) => void;
  onOpenFileBlame?: (filePath: string) => void;
}

export function CompareTab({
  repository,
  branches,
  onSelectCommit,
  onOpenFileBlame,
}: CompareTabProps) {
  // Default base: main / master or first branch; compare: current branch
  const defaultBase =
    branches.find((b) => b.name === 'main' || b.name === 'master')?.name ||
    branches[0]?.name ||
    'main';
  const defaultCompare =
    repository.currentBranch !== defaultBase
      ? repository.currentBranch
      : branches.find((b) => b.name !== defaultBase)?.name || repository.currentBranch;

  const [baseRef, setBaseRef] = useState<string>(defaultBase);
  const [compareRef, setCompareRef] = useState<string>(defaultCompare);
  const [comparison, setComparison] = useState<BranchComparison | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<string | null>(null);
  const [fileDiff, setFileDiff] = useState<FileDiff | null>(null);
  const [fileDiffLoading, setFileDiffLoading] = useState<boolean>(false);
  const [diffLayout, setDiffLayout] = useState<'unified' | 'split'>('unified');
  const [showCommits, setShowCommits] = useState<boolean>(false);
  const [, startTransition] = useTransition();

  // Load comparison whenever baseRef or compareRef changes
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    setSelectedFile(null);
    setFileDiff(null);

    gitService
      .compareBranches(repository.path, baseRef, compareRef)
      .then((data) => {
        if (!active) return;
        startTransition(() => {
          setComparison(data);
          setLoading(false);
          if (data.changedFiles.length > 0) {
            setSelectedFile(data.changedFiles[0].path);
          }
        });
      })
      .catch((err) => {
        if (!active) return;
        setError(err instanceof Error ? err.message : String(err));
        setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [repository.path, baseRef, compareRef]);

  // Load file diff when selected file changes
  useEffect(() => {
    if (!selectedFile) {
      setFileDiff(null);
      return;
    }
    let active = true;
    setFileDiffLoading(true);

    gitService
      .getComparisonFileDiff(repository.path, baseRef, compareRef, selectedFile)
      .then((diff) => {
        if (active) {
          setFileDiff(diff);
          setFileDiffLoading(false);
        }
      })
      .catch((err) => {
        if (active) {
          console.error('Failed to load file diff:', err);
          setFileDiffLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [repository.path, baseRef, compareRef, selectedFile]);

  const handleSwap = () => {
    const prevBase = baseRef;
    setBaseRef(compareRef);
    setCompareRef(prevBase);
  };

  const totalAdditions = comparison?.changedFiles.reduce((acc, f) => acc + f.additions, 0) || 0;
  const totalDeletions = comparison?.changedFiles.reduce((acc, f) => acc + f.deletions, 0) || 0;

  return (
    <div className="flex flex-col h-full overflow-hidden text-sm">
      {/* Branch selector & control toolbar */}
      <div className="p-3 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-900/40 shrink-0">
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 font-medium">Base:</span>
            <select
              value={baseRef}
              onChange={(e) => setBaseRef(e.target.value)}
              className="px-2 py-1 text-xs font-mono font-medium rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent-500 max-w-[180px]"
            >
              {branches.map((b) => (
                <option key={`base-${b.name}`} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          <button
            type="button"
            onClick={handleSwap}
            title="Swap base and compare branches"
            className="p-1 rounded text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-200 dark:hover:bg-neutral-800 transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" />
            </svg>
          </button>

          <div className="flex items-center gap-1.5">
            <span className="text-xs text-neutral-500 font-medium">Compare:</span>
            <select
              value={compareRef}
              onChange={(e) => setCompareRef(e.target.value)}
              className="px-2 py-1 text-xs font-mono font-medium rounded border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-accent-500 max-w-[180px]"
            >
              {branches.map((b) => (
                <option key={`comp-${b.name}`} value={b.name}>
                  {b.name}
                </option>
              ))}
            </select>
          </div>

          {comparison && !loading && (
            <div className="ml-auto flex items-center gap-2">
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                +{comparison.aheadCount} ahead
              </span>
              <span className="px-2 py-0.5 rounded text-xs font-mono font-semibold bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                -{comparison.behindCount} behind
              </span>
              <button
                type="button"
                onClick={() => setShowCommits(!showCommits)}
                className={`px-2 py-1 text-xs font-medium rounded border transition-colors ${
                  showCommits
                    ? 'bg-neutral-200 dark:bg-neutral-700 border-neutral-400 text-neutral-900 dark:text-white'
                    : 'bg-white dark:bg-neutral-800 border-neutral-300 dark:border-neutral-700 text-neutral-700 dark:text-neutral-300'
                }`}
              >
                {showCommits ? 'Hide Commits' : 'View Commits'}
              </button>
            </div>
          )}
        </div>

        {/* Collapsible commit logs */}
        {showCommits && comparison && (
          <div className="mt-3 pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-2 gap-3 max-h-48 overflow-y-auto">
            <div>
              <div className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 mb-1.5 flex items-center gap-1">
                <span>Commits in {compareRef}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-emerald-500/10 rounded">
                  {comparison.aheadCommits.length}
                </span>
              </div>
              {comparison.aheadCommits.length === 0 ? (
                <div className="text-xs text-neutral-400 italic">No ahead commits</div>
              ) : (
                <ul className="space-y-1">
                  {comparison.aheadCommits.map((c) => (
                    <li
                      key={c.hash}
                      onClick={() => onSelectCommit?.(c.hash)}
                      className="p-1.5 rounded bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 text-xs cursor-pointer hover:border-accent-500 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] text-neutral-400">
                        <span className="font-mono text-accent-600 dark:text-accent-400">{c.shortHash}</span>
                        <span>{formatRelative(c.date)}</span>
                      </div>
                      <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                        {c.subject}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div>
              <div className="text-xs font-semibold text-rose-600 dark:text-rose-400 mb-1.5 flex items-center gap-1">
                <span>Commits in {baseRef}</span>
                <span className="text-[10px] px-1.5 py-0.2 bg-rose-500/10 rounded">
                  {comparison.behindCommits.length}
                </span>
              </div>
              {comparison.behindCommits.length === 0 ? (
                <div className="text-xs text-neutral-400 italic">No behind commits</div>
              ) : (
                <ul className="space-y-1">
                  {comparison.behindCommits.map((c) => (
                    <li
                      key={c.hash}
                      onClick={() => onSelectCommit?.(c.hash)}
                      className="p-1.5 rounded bg-white dark:bg-neutral-800/80 border border-neutral-200/60 dark:border-neutral-700/60 text-xs cursor-pointer hover:border-accent-500 transition-colors"
                    >
                      <div className="flex items-center justify-between gap-1 text-[11px] text-neutral-400">
                        <span className="font-mono text-accent-600 dark:text-accent-400">{c.shortHash}</span>
                        <span>{formatRelative(c.date)}</span>
                      </div>
                      <div className="font-medium text-neutral-800 dark:text-neutral-200 truncate mt-0.5">
                        {c.subject}
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Main comparison content */}
      {loading ? (
        <div className="flex-1 flex items-center justify-center text-neutral-400 text-xs">
          <div className="flex items-center gap-2">
            <svg className="w-4 h-4 animate-spin text-accent-500" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
            </svg>
            <span>Comparing {baseRef}...{compareRef}...</span>
          </div>
        </div>
      ) : error ? (
        <div className="p-4 m-4 rounded border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 text-xs">
          {error}
        </div>
      ) : !comparison || comparison.changedFiles.length === 0 ? (
        <div className="flex-1 flex flex-col items-center justify-center text-center p-6 text-neutral-400">
          <svg className="w-10 h-10 mb-2 stroke-neutral-300 dark:stroke-neutral-700" fill="none" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p className="font-medium text-neutral-600 dark:text-neutral-300 text-sm">Branches are in sync</p>
          <p className="text-xs text-neutral-400 mt-1">
            No file differences between <code className="font-mono">{baseRef}</code> and{' '}
            <code className="font-mono">{compareRef}</code>.
          </p>
        </div>
      ) : (
        <div className="flex-1 flex overflow-hidden">
          {/* Changed file list sidebar */}
          <div className="w-64 border-r border-neutral-200 dark:border-neutral-800 flex flex-col shrink-0 bg-white dark:bg-neutral-900/30">
            <div className="p-2.5 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between text-xs text-neutral-500 font-medium">
              <span>{comparison.changedFiles.length} Changed Files</span>
              <span className="font-mono">
                <span className="text-emerald-600 dark:text-emerald-400">+{totalAdditions}</span>{' '}
                <span className="text-rose-600 dark:text-rose-400">-{totalDeletions}</span>
              </span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 dark:divide-neutral-800/60">
              {comparison.changedFiles.map((f) => (
                <div
                  key={f.path}
                  onClick={() => setSelectedFile(f.path)}
                  className={`p-2.5 text-xs cursor-pointer flex items-center justify-between gap-1.5 transition-colors ${
                    selectedFile === f.path
                      ? 'bg-accent-50/80 dark:bg-accent-950/30 border-l-2 border-accent-500 font-medium text-neutral-900 dark:text-white'
                      : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/50 text-neutral-700 dark:text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-1.5 min-w-0">
                    <span
                      className={`w-4 h-4 shrink-0 rounded flex items-center justify-center text-[10px] font-bold ${
                        f.status === 'A'
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : f.status === 'D'
                          ? 'bg-rose-500/10 text-rose-600 dark:text-rose-400'
                          : f.status === 'R'
                          ? 'bg-purple-500/10 text-purple-600 dark:text-purple-400'
                          : 'bg-amber-500/10 text-amber-600 dark:text-amber-400'
                      }`}
                    >
                      {f.status}
                    </span>
                    <span className="truncate font-mono text-[11px]" title={f.path}>
                      {f.path.split('/').pop()}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    <span className="font-mono text-[10px] text-neutral-400">
                      {f.additions > 0 && <span className="text-emerald-600">+{f.additions}</span>}
                      {f.deletions > 0 && <span className="text-rose-600"> -{f.deletions}</span>}
                    </span>
                    {onOpenFileBlame && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenFileBlame(f.path);
                        }}
                        title={`View blame for ${f.path}`}
                        className="px-1 py-0.5 text-[10px] text-neutral-400 hover:text-accent-500 hover:bg-neutral-100 dark:hover:bg-neutral-800 rounded transition-colors"
                      >
                        Blame
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Diff viewer pane */}
          <div className="flex-1 flex flex-col overflow-hidden bg-white dark:bg-neutral-900">
            {selectedFile && (
              <div className="p-2 border-b border-neutral-200 dark:border-neutral-800 flex items-center justify-between gap-2 bg-neutral-50/40 dark:bg-neutral-900/40">
                <span className="font-mono text-xs text-neutral-700 dark:text-neutral-300 truncate">
                  {selectedFile}
                </span>
                <div className="flex items-center gap-1">
                  <div className="flex rounded border border-neutral-200 dark:border-neutral-700 overflow-hidden text-xs">
                    <button
                      type="button"
                      onClick={() => setDiffLayout('unified')}
                      className={`px-2 py-0.5 ${
                        diffLayout === 'unified'
                          ? 'bg-neutral-200 dark:bg-neutral-700 font-semibold'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Unified
                    </button>
                    <button
                      type="button"
                      onClick={() => setDiffLayout('split')}
                      className={`px-2 py-0.5 ${
                        diffLayout === 'split'
                          ? 'bg-neutral-200 dark:bg-neutral-700 font-semibold'
                          : 'hover:bg-neutral-100 dark:hover:bg-neutral-800'
                      }`}
                    >
                      Side by Side
                    </button>
                  </div>
                  {onOpenFileBlame && (
                    <button
                      type="button"
                      onClick={() => onOpenFileBlame(selectedFile)}
                      className="px-2 py-1 text-xs rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300 transition-colors"
                    >
                      View Blame
                    </button>
                  )}
                </div>
              </div>
            )}

            <div className="flex-1 overflow-auto">
              {fileDiffLoading ? (
                <div className="h-full flex items-center justify-center text-neutral-400 text-xs">
                  Loading diff...
                </div>
              ) : fileDiff ? (
                <DiffViewer diff={fileDiff} mode={diffLayout} />
              ) : (
                <div className="h-full flex items-center justify-center text-neutral-400 text-xs">
                  Select a changed file to view its diff
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

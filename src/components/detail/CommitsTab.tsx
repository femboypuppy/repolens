import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import type { DiffViewMode, GitCommit, Repository } from '../../types';
import { errorMessage, gitService } from '../../services/gitService';
import { CommitGraph } from './CommitGraph';
import { CommitDetail } from './CommitDetail';

const PAGE = 50;

interface CommitsTabProps {
  repository: Repository;
  diffMode: DiffViewMode;
  onDiffModeChange: (m: DiffViewMode) => void;
  onOpenFileBlame?: (filePath: string) => void;
  targetCommitHash?: string | null;
}

export const CommitsTab: React.FC<CommitsTabProps> = ({
  repository,
  diffMode,
  onDiffModeChange,
  onOpenFileBlame,
  targetCommitHash,
}) => {
  const [commits, setCommits] = useState<GitCommit[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [allRefs, setAllRefs] = useState(false);
  const [filter, setFilter] = useState('');
  const [selected, setSelected] = useState<GitCommit | null>(null);
  const runId = useRef(0);
  const head = repository.lastCommit?.hash ?? '';

  useEffect(() => {
    const id = ++runId.current;
    setLoading(true);
    setError(null);
    gitService.getCommits(repository.path, PAGE, 0, allRefs).then(
      (c) => {
        if (id !== runId.current) return;
        setCommits(c);
        setHasMore(c.length === PAGE);
        setLoading(false);
      },
      (e) => {
        if (id !== runId.current) return;
        setError(errorMessage(e));
        setLoading(false);
      },
    );
  }, [repository.path, allRefs, head]);

  useEffect(() => setSelected(null), [repository.path]);

  const loadMore = () => {
    const id = runId.current;
    setLoading(true);
    gitService.getCommits(repository.path, PAGE, commits.length, allRefs).then(
      (more) => {
        if (id !== runId.current) return;
        setCommits((prev) => [...prev, ...more]);
        setHasMore(more.length === PAGE);
        setLoading(false);
      },
      (e) => {
        if (id !== runId.current) return;
        setError(errorMessage(e));
        setLoading(false);
      },
    );
  };

  const remoteNames = useMemo(() => new Set(repository.remotes.map((r) => r.name)), [repository.remotes]);
  const q = filter.trim().toLowerCase();
  const visible = q
    ? (c: GitCommit) =>
        c.subject.toLowerCase().includes(q) ||
        c.author.toLowerCase().includes(q) ||
        c.hash.startsWith(q) ||
        c.body.toLowerCase().includes(q)
    : undefined;

  useEffect(() => {
    if (!targetCommitHash) return;
    const found = commits.find((c) => c.hash.startsWith(targetCommitHash));
    if (found) {
      setSelected(found);
    }
  }, [targetCommitHash, commits]);

  if (selected) {
    return (
      <CommitDetail
        repoPath={repository.path}
        info={{
          hash: selected.hash,
          title: selected.subject,
          body: selected.body,
          author: `${selected.author} <${selected.authorEmail}>`,
          date: selected.date,
          parents: selected.parents,
        }}
        onBack={() => setSelected(null)}
        diffMode={diffMode}
        onDiffModeChange={onDiffModeChange}
        onOpenFileBlame={onOpenFileBlame}
      />
    );
  }

  if (repository.isUnborn) {
    return <p className="py-8 text-center text-xs text-neutral-400">This repository has no commits yet.</p>;
  }

  const shownCount = visible ? commits.filter(visible).length : commits.length;

  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter loaded commits"
            aria-label="Filter loaded commits by message, author, or hash"
            className="input w-full pl-7"
          />
        </div>
        <label className="flex items-center gap-1.5 text-xs text-neutral-600 dark:text-neutral-300 whitespace-nowrap">
          <input type="checkbox" checked={allRefs} onChange={(e) => setAllRefs(e.target.checked)} className="accent-blue-600" />
          All branches
        </label>
      </div>

      {error && (
        <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">
          Could not load commits: {error}
        </p>
      )}

      {loading && commits.length === 0 ? (
        <div className="space-y-3 py-2" aria-busy="true" aria-label="Loading commits">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="flex items-center gap-3">
              <div className="skeleton w-3 h-3 rounded-full" />
              <div className="flex-1 space-y-1.5">
                <div className="skeleton h-3" style={{ width: `${55 + ((i * 13) % 35)}%` }} />
                <div className="skeleton h-2.5 w-1/3" />
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          {visible && (
            <p className="text-[11px] text-neutral-500">
              {shownCount} of {commits.length} loaded commits match. The graph is hidden while filtering.
            </p>
          )}
          <CommitGraph commits={commits} selectedHash={null} onSelect={setSelected} visible={visible} remoteNames={remoteNames} />
          {hasMore && (
            <button type="button" onClick={loadMore} disabled={loading} className="btn w-full justify-center">
              {loading ? 'Loading…' : `Load ${PAGE} more`}
            </button>
          )}
        </>
      )}
    </div>
  );
};

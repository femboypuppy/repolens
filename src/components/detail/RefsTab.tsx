import React, { useEffect, useState } from 'react';
import { GitBranch, Tag, Archive, FolderTree, ArrowUp, ArrowDown, Lock, AlertTriangle } from 'lucide-react';
import type { DiffViewMode, GitStash, Repository } from '../../types';
import { gitService } from '../../services/gitService';
import { useAsync } from '../../hooks/useAsync';
import { formatAbsolute, formatRelative } from '../../utils/time';
import { CommitDetail, CopyButton } from './CommitDetail';

type Section = 'branches' | 'tags' | 'stashes' | 'worktrees';

interface RefsTabProps {
  repository: Repository;
  diffMode: DiffViewMode;
  onDiffModeChange: (m: DiffViewMode) => void;
}

const Empty: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="py-8 text-center text-xs text-neutral-400">{children}</p>
);
const Loading = () => (
  <div className="space-y-2 py-2" aria-busy="true">
    {[1, 2, 3].map((i) => (
      <div key={i} className="skeleton h-8" />
    ))}
  </div>
);
const ErrorText: React.FC<{ error: string }> = ({ error }) => (
  <p role="alert" className="text-xs text-rose-600 dark:text-rose-400 py-2">
    {error}
  </p>
);

const rowCls = 'flex items-center gap-2 px-2 py-2 rounded-md text-xs';

export const RefsTab: React.FC<RefsTabProps> = ({ repository, diffMode, onDiffModeChange }) => {
  const [section, setSection] = useState<Section>('branches');
  const [stash, setStash] = useState<GitStash | null>(null);
  const path = repository.path;
  const rev = `${repository.lastCommit?.hash}|${repository.stashCount}|${repository.currentBranch}`;

  useEffect(() => setStash(null), [path]);

  const branches = useAsync(() => gitService.getBranches(path), [path, rev], section === 'branches');
  const tags = useAsync(() => gitService.getTags(path), [path, rev], section === 'tags');
  const stashes = useAsync(() => gitService.getStashes(path), [path, rev], section === 'stashes');
  const worktrees = useAsync(() => gitService.getWorktrees(path), [path, rev], section === 'worktrees');

  if (stash) {
    return (
      <CommitDetail
        repoPath={path}
        info={{ hash: stash.hash, title: stash.message, date: stash.date, badge: stash.reference }}
        onBack={() => setStash(null)}
        diffMode={diffMode}
        onDiffModeChange={onDiffModeChange}
      />
    );
  }

  const tabs: { id: Section; label: string; icon: React.ReactNode }[] = [
    { id: 'branches', label: 'Branches', icon: <GitBranch className="w-3.5 h-3.5" /> },
    { id: 'tags', label: 'Tags', icon: <Tag className="w-3.5 h-3.5" /> },
    { id: 'stashes', label: 'Stashes', icon: <Archive className="w-3.5 h-3.5" /> },
    { id: 'worktrees', label: 'Worktrees', icon: <FolderTree className="w-3.5 h-3.5" /> },
  ];

  return (
    <div className="space-y-3">
      <div className="segmented w-full" role="tablist" aria-label="Reference type">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            role="tab"
            aria-selected={section === t.id}
            onClick={() => setSection(t.id)}
            className="flex-1 inline-flex items-center justify-center gap-1"
          >
            {t.icon}
            <span className="hidden min-[420px]:inline">{t.label}</span>
          </button>
        ))}
      </div>

      {section === 'branches' &&
        (branches.loading ? (
          <Loading />
        ) : branches.error ? (
          <ErrorText error={branches.error} />
        ) : !branches.data?.length ? (
          <Empty>No local branches{repository.isUnborn ? ' — the repository has no commits yet' : ''}.</Empty>
        ) : (
          <ul className="space-y-0.5">
            {branches.data.map((b) => (
              <li key={b.name} className={`${rowCls} ${b.isCurrent ? 'bg-blue-50 dark:bg-blue-500/10' : ''}`}>
                <GitBranch className={`w-3.5 h-3.5 shrink-0 ${b.isCurrent ? 'text-blue-600' : 'text-neutral-400'}`} />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className={`font-mono truncate selectable ${b.isCurrent ? 'font-semibold text-blue-700 dark:text-blue-300' : 'text-neutral-800 dark:text-neutral-200'}`}>
                      {b.name}
                    </span>
                    {b.isCurrent && <span className="chip bg-blue-600 text-white">current</span>}
                  </div>
                  <div className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate">
                    {b.lastCommitSubject} · {formatRelative(b.lastCommitDate)}
                  </div>
                </div>
                <div className="text-[11px] font-mono text-right shrink-0">
                  {b.upstream ? (
                    b.upstreamGone ? (
                      <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400" title={`${b.upstream} no longer exists`}>
                        <AlertTriangle className="w-3 h-3" /> upstream gone
                      </span>
                    ) : (
                      <span className="text-neutral-500" title={`Tracking ${b.upstream}`}>
                        <span className="block truncate max-w-[160px]">{b.upstream}</span>
                        {(b.ahead > 0 || b.behind > 0) ? (
                          <span className="inline-flex gap-1.5">
                            {b.ahead > 0 && <span className="inline-flex items-center text-blue-600 dark:text-blue-400"><ArrowUp className="w-3 h-3" />{b.ahead}</span>}
                            {b.behind > 0 && <span className="inline-flex items-center text-rose-600 dark:text-rose-400"><ArrowDown className="w-3 h-3" />{b.behind}</span>}
                          </span>
                        ) : (
                          <span className="text-neutral-400">in sync</span>
                        )}
                      </span>
                    )
                  ) : (
                    <span className="italic text-neutral-400">no upstream</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        ))}

      {section === 'tags' &&
        (tags.loading ? (
          <Loading />
        ) : tags.error ? (
          <ErrorText error={tags.error} />
        ) : !tags.data?.length ? (
          <Empty>No tags.</Empty>
        ) : (
          <ul className="space-y-0.5">
            {tags.data.map((t) => (
              <li key={t.name} className={rowCls}>
                <Tag className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-neutral-800 dark:text-neutral-200 truncate selectable">{t.name}</div>
                  <div className="text-[11px] text-neutral-500 truncate">
                    {t.subject || '—'} · <time title={formatAbsolute(t.date)}>{formatRelative(t.date)}</time>
                  </div>
                </div>
                <CopyButton value={t.target} label="Copy target commit hash" display={t.target.slice(0, 7)} />
              </li>
            ))}
          </ul>
        ))}

      {section === 'stashes' &&
        (stashes.loading ? (
          <Loading />
        ) : stashes.error ? (
          <ErrorText error={stashes.error} />
        ) : !stashes.data?.length ? (
          <Empty>No stashes.</Empty>
        ) : (
          <ul className="space-y-0.5">
            {stashes.data.map((s) => (
              <li key={s.reference}>
                <button
                  type="button"
                  onClick={() => setStash(s)}
                  className={`${rowCls} w-full text-left hover:bg-neutral-100 dark:hover:bg-neutral-800/60 transition-colors`}
                >
                  <Archive className="w-3.5 h-3.5 text-violet-500 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <div className="text-neutral-800 dark:text-neutral-200 truncate">{s.message}</div>
                    <div className="text-[11px] text-neutral-500 font-mono">
                      {s.reference} · {formatRelative(s.date)}
                    </div>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        ))}

      {section === 'worktrees' &&
        (worktrees.loading ? (
          <Loading />
        ) : worktrees.error ? (
          <ErrorText error={worktrees.error} />
        ) : !worktrees.data?.length ? (
          <Empty>No worktrees.</Empty>
        ) : (
          <ul className="space-y-0.5">
            {worktrees.data.map((w) => (
              <li key={w.path} className={rowCls}>
                <FolderTree className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <div className="min-w-0 flex-1">
                  <div className="font-mono text-neutral-800 dark:text-neutral-200 truncate selectable" title={w.path}>
                    {w.path}
                  </div>
                  <div className="text-[11px] text-neutral-500 flex flex-wrap gap-1.5">
                    <span>{w.isBare ? 'bare' : w.isDetached ? `detached at ${w.head?.slice(0, 7) ?? '?'}` : w.branch ?? '—'}</span>
                    {w.isMain && <span className="chip bg-neutral-100 dark:bg-neutral-800">main</span>}
                    {w.isLocked && (
                      <span className="chip bg-neutral-100 dark:bg-neutral-800">
                        <Lock className="w-2.5 h-2.5" /> locked
                      </span>
                    )}
                    {w.isPrunable && <span className="chip bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300">missing</span>}
                  </div>
                </div>
                <CopyButton value={w.path} label="Copy worktree path" />
              </li>
            ))}
          </ul>
        ))}
    </div>
  );
};

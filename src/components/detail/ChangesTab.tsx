import React, { useEffect, useMemo, useState } from 'react';
import {
  FileText,
  FilePlus,
  FileMinus,
  FileEdit,
  HelpCircle,
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
} from 'lucide-react';
import type {
  ChangedFile,
  DiffViewMode,
  FileChangeStatus,
  FileDiff,
  Repository,
} from '../../types';
import { gitService, diffKindsFor } from '../../services/gitService';
import { useAsync } from '../../hooks/useAsync';
import { DiffViewer } from '../DiffViewer';

interface ChangesTabProps {
  repository: Repository;
  diffMode: DiffViewMode;
  onDiffModeChange: (mode: DiffViewMode) => void;
  onOpenFileBlame?: (filePath: string) => void;
}

interface SelectedDiffTarget {
  path: string;
  oldPath?: string | null;
  kind: 'staged' | 'unstaged' | 'untracked';
}

const statusBadge = (status: FileChangeStatus) => {
  switch (status) {
    case 'added':
      return <span className="chip bg-emerald-50 dark:bg-emerald-500/15 text-emerald-700 dark:text-emerald-300">added</span>;
    case 'deleted':
      return <span className="chip bg-rose-50 dark:bg-rose-500/15 text-rose-700 dark:text-rose-300">deleted</span>;
    case 'modified':
      return <span className="chip bg-amber-50 dark:bg-amber-500/15 text-amber-700 dark:text-amber-300">modified</span>;
    case 'renamed':
      return <span className="chip bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">renamed</span>;
    case 'copied':
      return <span className="chip bg-purple-50 dark:bg-purple-500/15 text-purple-700 dark:text-purple-300">copied</span>;
    case 'typechange':
      return <span className="chip bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">typechange</span>;
    case 'unmerged':
      return <span className="chip bg-rose-100 dark:bg-rose-900/40 text-rose-800 dark:text-rose-200">conflict</span>;
    case 'untracked':
      return <span className="chip bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300">untracked</span>;
    default:
      return null;
  }
};

const statusIcon = (status: FileChangeStatus) => {
  switch (status) {
    case 'added':
      return <FilePlus className="w-3.5 h-3.5 text-emerald-500 shrink-0" />;
    case 'deleted':
      return <FileMinus className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'modified':
      return <FileEdit className="w-3.5 h-3.5 text-amber-500 shrink-0" />;
    case 'unmerged':
      return <AlertTriangle className="w-3.5 h-3.5 text-rose-500 shrink-0" />;
    case 'untracked':
      return <HelpCircle className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
    default:
      return <FileText className="w-3.5 h-3.5 text-neutral-400 shrink-0" />;
  }
};

export const ChangesTab: React.FC<ChangesTabProps> = ({
  repository,
  diffMode,
  onDiffModeChange,
  onOpenFileBlame,
}) => {
  const path = repository.path;
  const rev = `${repository.totalChanges}-${repository.stagedCount}-${repository.unstagedCount}-${repository.untrackedCount}`;

  const { data: changedData, loading: changesLoading, error: changesError } = useAsync(
    () => gitService.getChangedFiles(path),
    [path, rev],
    true
  );

  const [selected, setSelected] = useState<SelectedDiffTarget | null>(null);

  const files = useMemo(() => changedData?.files ?? [], [changedData]);

  // Group files
  const stagedFiles = useMemo(
    () => files.filter((f) => f.stagedStatus !== 'none' && f.stagedStatus !== 'unmerged' && f.stagedStatus !== 'untracked'),
    [files]
  );
  const unstagedFiles = useMemo(
    () => files.filter((f) => f.unstagedStatus !== 'none' && f.unstagedStatus !== 'unmerged' && f.stagedStatus !== 'untracked'),
    [files]
  );
  const untrackedFiles = useMemo(
    () => files.filter((f) => f.stagedStatus === 'untracked' || f.unstagedStatus === 'untracked'),
    [files]
  );
  const conflictedFiles = useMemo(
    () => files.filter((f) => f.stagedStatus === 'unmerged' || f.unstagedStatus === 'unmerged'),
    [files]
  );

  // Auto-select first changed file when files load or repository changes
  useEffect(() => {
    if (files.length === 0) {
      setSelected(null);
      return;
    }
    // If currently selected file is still in the list, keep it
    if (selected && files.some((f) => f.path === selected.path)) {
      return;
    }
    // Otherwise pick the first file with its primary change kind
    const first = conflictedFiles[0] || stagedFiles[0] || unstagedFiles[0] || untrackedFiles[0] || files[0];
    const kinds = diffKindsFor(first);
    setSelected({
      path: first.path,
      oldPath: first.oldPath,
      kind: kinds[0] || 'unstaged',
    });
  }, [files, conflictedFiles, stagedFiles, unstagedFiles, untrackedFiles, selected]);

  // Load diff for currently selected target
  const {
    data: activeDiff,
    loading: diffLoading,
    error: diffError,
  } = useAsync(
    () => {
      if (!selected) return Promise.resolve(null as FileDiff | null);
      return gitService.getFileDiff(path, {
        path: selected.path,
        oldPath: selected.oldPath,
        kind: selected.kind,
      });
    },
    [path, selected?.path, selected?.oldPath, selected?.kind],
    !!selected
  );

  if (changesLoading && files.length === 0) {
    return (
      <div className="space-y-3 py-4" aria-busy="true">
        {[40, 70, 55].map((w, i) => (
          <div key={i} className="skeleton h-6" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }

  if (changesError) {
    return (
      <div role="alert" className="p-3 text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-500/10 rounded-md">
        Could not read changed files: {changesError}
      </div>
    );
  }

  if (files.length === 0 && repository.totalChanges === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center text-xs text-neutral-400">
        <CheckCircle2 className="w-8 h-8 text-emerald-500 mb-2 opacity-80" />
        <p className="font-medium text-neutral-700 dark:text-neutral-300">Working directory clean</p>
        <p className="text-[11px] text-neutral-400 mt-1">No staged, unstaged, or untracked changes.</p>
      </div>
    );
  }

  const renderFileRow = (f: ChangedFile, kind: 'staged' | 'unstaged' | 'untracked') => {
    const isSelected = selected?.path === f.path && selected?.kind === kind;
    const status = kind === 'staged' ? f.stagedStatus : kind === 'unstaged' ? f.unstagedStatus : 'untracked';

    return (
      <button
        key={`${f.path}-${kind}`}
        type="button"
        onClick={() => setSelected({ path: f.path, oldPath: f.oldPath, kind })}
        className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-md text-xs font-mono text-left transition-colors ${
          isSelected
            ? 'bg-blue-50 dark:bg-blue-500/15 text-blue-900 dark:text-blue-100 font-medium'
            : 'hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300'
        }`}
      >
        <div className="flex items-center gap-2 min-w-0 flex-1 mr-2">
          {statusIcon(status)}
          <span className="truncate" title={f.path}>
            {f.path}
          </span>
          {f.oldPath && f.oldPath !== f.path && (
            <span className="text-[10px] text-neutral-400 flex items-center gap-1 shrink-0">
              <ArrowRight className="w-2.5 h-2.5" />
              <span className="truncate max-w-[80px]">{f.oldPath}</span>
            </span>
          )}
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {onOpenFileBlame && (
            <span
              role="button"
              tabIndex={0}
              onClick={(e) => {
                e.stopPropagation();
                onOpenFileBlame(f.path);
              }}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.stopPropagation();
                  onOpenFileBlame(f.path);
                }
              }}
              title={`Blame / History for ${f.path}`}
              className="px-1.5 py-0.5 rounded text-[10px] text-neutral-400 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition-colors"
            >
              Blame
            </span>
          )}
          {statusBadge(status)}
        </div>
      </button>
    );
  };

  return (
    <div className="space-y-4">
      {/* File Groupings */}
      <div className="space-y-3">
        {conflictedFiles.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-rose-600 dark:text-rose-400 uppercase tracking-wider px-1">
              <span>Conflicts ({conflictedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
              {conflictedFiles.map((f) => renderFileRow(f, 'unstaged'))}
            </div>
          </div>
        )}

        {stagedFiles.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              <span>Staged Changes ({stagedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
              {stagedFiles.map((f) => renderFileRow(f, 'staged'))}
            </div>
          </div>
        )}

        {unstagedFiles.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              <span>Unstaged Changes ({unstagedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
              {unstagedFiles.map((f) => renderFileRow(f, 'unstaged'))}
            </div>
          </div>
        )}

        {untrackedFiles.length > 0 && (
          <div className="space-y-1">
            <div className="flex items-center justify-between text-[11px] font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wider px-1">
              <span>Untracked Files ({untrackedFiles.length})</span>
            </div>
            <div className="space-y-0.5">
              {untrackedFiles.map((f) => renderFileRow(f, 'untracked'))}
            </div>
          </div>
        )}
      </div>

      {changedData?.truncated && (
        <p className="text-[11px] text-amber-700 dark:text-amber-400 italic px-1">
          Showing first 1,000 changed files (truncated).
        </p>
      )}

      {/* Diff View for Selected File */}
      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-3">
        {selected ? (
          <DiffViewer
            diff={activeDiff || null}
            isLoading={diffLoading}
            error={diffError}
            label={selected.kind === 'staged' ? 'Staged' : selected.kind === 'untracked' ? 'Untracked' : 'Unstaged'}
            mode={diffMode}
            onModeChange={onDiffModeChange}
          />
        ) : (
          <div className="p-6 text-center text-xs text-neutral-400">
            Select a changed file to view its diff.
          </div>
        )}
      </div>
    </div>
  );
};

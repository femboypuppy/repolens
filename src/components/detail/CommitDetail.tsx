import React, { useState } from 'react';
import { ArrowLeft, Check, Copy, ChevronDown, ChevronRight } from 'lucide-react';
import type { DiffViewMode, FileDiff } from '../../types';
import { gitService } from '../../services/gitService';
import { useAsync } from '../../hooks/useAsync';
import { DiffViewer } from '../DiffViewer';
import { formatAbsolute } from '../../utils/time';

export interface CommitHeaderInfo {
  hash: string;
  title: string;
  body?: string;
  author?: string;
  date: string;
  parents?: string[];
  /** e.g. "stash@{0}" */
  badge?: string;
}

interface CommitDetailProps {
  repoPath: string;
  info: CommitHeaderInfo;
  onBack: () => void;
  diffMode: DiffViewMode;
  onDiffModeChange: (m: DiffViewMode) => void;
}

export function useCopy(): [string | null, (value: string) => void] {
  const [copied, setCopied] = useState<string | null>(null);
  const copy = (value: string) => {
    navigator.clipboard?.writeText(value).then(
      () => {
        setCopied(value);
        setTimeout(() => setCopied((c) => (c === value ? null : c)), 1500);
      },
      () => undefined,
    );
  };
  return [copied, copy];
}

export const CopyButton: React.FC<{ value: string; label: string; display?: string; className?: string }> = ({
  value,
  label,
  display,
  className = '',
}) => {
  const [copied, copy] = useCopy();
  const done = copied === value;
  return (
    <button
      type="button"
      onClick={(e) => {
        e.stopPropagation();
        copy(value);
      }}
      className={`inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-[11px] text-neutral-500 hover:text-blue-600 dark:hover:text-blue-400 hover:bg-black/5 dark:hover:bg-white/10 transition-colors ${className}`}
      aria-label={done ? 'Copied' : label}
      title={done ? 'Copied' : label}
    >
      {done ? <Check className="w-3 h-3 text-emerald-500" /> : <Copy className="w-3 h-3" />}
      {display && <span>{display}</span>}
    </button>
  );
};

const FileSection: React.FC<{ file: FileDiff; mode: DiffViewMode; onModeChange: (m: DiffViewMode) => void; defaultOpen: boolean }> = ({
  file,
  mode,
  onModeChange,
  defaultOpen,
}) => {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-1 py-1 text-left text-[11px] font-mono text-neutral-700 dark:text-neutral-200 hover:bg-black/5 dark:hover:bg-white/5 rounded"
      >
        {open ? <ChevronDown className="w-3 h-3 shrink-0" /> : <ChevronRight className="w-3 h-3 shrink-0" />}
        <span className="truncate flex-1">{file.path}</span>
        {file.isBinary ? (
          <span className="text-neutral-400">binary</span>
        ) : (
          <span className="tabular-nums">
            <span className="text-emerald-600 dark:text-emerald-400">+{file.additions}</span>{' '}
            <span className="text-rose-600 dark:text-rose-400">−{file.deletions}</span>
          </span>
        )}
      </button>
      {open && (
        <div className="mt-1 mb-3">
          <DiffViewer diff={file} mode={mode} onModeChange={onModeChange} />
        </div>
      )}
    </div>
  );
};

export const CommitDetail: React.FC<CommitDetailProps> = ({ repoPath, info, onBack, diffMode, onDiffModeChange }) => {
  const { data, error, loading } = useAsync(() => gitService.getCommitDiff(repoPath, info.hash), [repoPath, info.hash]);

  return (
    <div className="space-y-3">
      <button type="button" onClick={onBack} className="btn">
        <ArrowLeft className="w-3.5 h-3.5" /> Back
      </button>

      <div className="space-y-1.5">
        <div className="flex items-start gap-2">
          {info.badge && <span className="chip bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 font-mono">{info.badge}</span>}
          <h3 className="text-sm font-semibold leading-snug text-neutral-900 dark:text-neutral-100 selectable">{info.title}</h3>
        </div>
        {info.body && (
          <pre className="whitespace-pre-wrap font-sans text-xs text-neutral-600 dark:text-neutral-300 selectable">{info.body}</pre>
        )}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-neutral-500 dark:text-neutral-400">
          {info.author && <span>{info.author}</span>}
          <time dateTime={info.date}>{formatAbsolute(info.date)}</time>
          <CopyButton value={info.hash} label="Copy full commit hash" display={info.hash.slice(0, 10)} />
          {info.parents && info.parents.length > 0 && (
            <span className="font-mono">
              {info.parents.length > 1 ? 'parents' : 'parent'} {info.parents.map((p) => p.slice(0, 7)).join(', ')}
            </span>
          )}
        </div>
      </div>

      <div className="border-t border-neutral-200 dark:border-neutral-800 pt-2">
        {loading ? (
          <div className="space-y-2 py-2" aria-busy="true">
            {[60, 45, 70].map((w, i) => (
              <div key={i} className="skeleton h-3" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : error ? (
          <p role="alert" className="text-xs text-rose-600 dark:text-rose-400">Could not load commit: {error}</p>
        ) : data && data.files.length === 0 ? (
          <p className="text-xs text-neutral-400 py-2">This commit has no file changes (for example, an empty or merge-only commit).</p>
        ) : (
          data && (
            <>
              <p className="section-label mb-1">
                {data.files.length} file{data.files.length === 1 ? '' : 's'} changed
              </p>
              {data.isTruncated && (
                <p className="text-[11px] text-amber-700 dark:text-amber-300 mb-2">Large commit — the diff was truncated.</p>
              )}
              {data.files.map((f, i) => (
                <FileSection key={`${f.path}-${i}`} file={f} mode={diffMode} onModeChange={onDiffModeChange} defaultOpen={i < 3} />
              ))}
            </>
          )
        )}
      </div>
    </div>
  );
};

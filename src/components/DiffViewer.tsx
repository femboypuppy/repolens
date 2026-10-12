import React, { useMemo } from 'react';
import { FileWarning, ArrowRight, Columns2, Rows3 } from 'lucide-react';
import type { DiffHunk, DiffLine, DiffViewMode, FileDiff } from '../types';
import { highlightCode, languageForPath } from '../utils/highlight';

interface DiffViewerProps {
  diff: FileDiff | null;
  isLoading?: boolean;
  error?: string | null;
  /** Short label shown in the header, e.g. "Staged" or "Unstaged". */
  label?: string;
  mode: DiffViewMode;
  onModeChange?: (mode: DiffViewMode) => void;
  /** Hide the per-file header (used when the caller renders its own). */
  hideHeader?: boolean;
}

/** Above this many lines, syntax highlighting is skipped to keep rendering fast. */
const HIGHLIGHT_LINE_BUDGET = 3000;

const ROW_BG: Record<DiffLine['type'], string> = {
  add: 'bg-emerald-50 dark:bg-emerald-500/10',
  delete: 'bg-rose-50 dark:bg-rose-500/10',
  context: '',
};
const GUTTER_BG: Record<DiffLine['type'], string> = {
  add: 'bg-emerald-100/70 dark:bg-emerald-500/15 text-emerald-800/70 dark:text-emerald-300/60',
  delete: 'bg-rose-100/70 dark:bg-rose-500/15 text-rose-800/70 dark:text-rose-300/60',
  context: 'text-neutral-400 dark:text-neutral-500',
};
const MARKER: Record<DiffLine['type'], string> = { add: '+', delete: '−', context: ' ' };

export interface SplitRow {
  left: DiffLine | null;
  right: DiffLine | null;
}

/** Pairs deletions with the additions that follow them so they line up side by side. */
export function toSplitRows(hunk: DiffHunk): SplitRow[] {
  const rows: SplitRow[] = [];
  const lines = hunk.lines;
  let i = 0;
  while (i < lines.length) {
    if (lines[i].type === 'context') {
      rows.push({ left: lines[i], right: lines[i] });
      i++;
      continue;
    }
    const dels: DiffLine[] = [];
    const adds: DiffLine[] = [];
    while (i < lines.length && lines[i].type === 'delete') dels.push(lines[i++]);
    while (i < lines.length && lines[i].type === 'add') adds.push(lines[i++]);
    const n = Math.max(dels.length, adds.length);
    for (let k = 0; k < n; k++) rows.push({ left: dels[k] ?? null, right: adds[k] ?? null });
  }
  return rows;
}

export const DiffViewer: React.FC<DiffViewerProps> = ({
  diff,
  isLoading,
  error,
  label,
  mode,
  onModeChange,
  hideHeader,
}) => {
  const language = useMemo(() => (diff ? languageForPath(diff.path) : null), [diff]);
  const totalLines = useMemo(() => diff?.hunks.reduce((n, h) => n + h.lines.length, 0) ?? 0, [diff]);
  const highlight = totalLines <= HIGHLIGHT_LINE_BUDGET;
  const code = (text: string) => (highlight ? highlightCode(text, language) : text);

  if (isLoading) {
    return (
      <div className="p-4 space-y-2" aria-busy="true" aria-label="Loading diff">
        {[70, 55, 80, 40].map((w, i) => (
          <div key={i} className="skeleton h-3" style={{ width: `${w}%` }} />
        ))}
      </div>
    );
  }
  if (error) {
    return (
      <div role="alert" className="m-3 p-3 rounded-md text-xs text-rose-700 dark:text-rose-300 bg-rose-50 dark:bg-rose-500/10">
        Could not load diff: {error}
      </div>
    );
  }
  if (!diff) {
    return <div className="p-6 text-center text-xs text-neutral-400">Select a file to view its changes.</div>;
  }

  return (
    <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 overflow-hidden content-surface">
      {!hideHeader && (
        <div className="flex items-center gap-2 px-3 h-9 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-850">
          <div className="flex items-center gap-1.5 min-w-0 flex-1 font-mono text-[11px] text-neutral-700 dark:text-neutral-200 selectable">
            {diff.oldPath && diff.oldPath !== diff.path && (
              <>
                <span className="truncate text-neutral-400">{diff.oldPath}</span>
                <ArrowRight className="w-3 h-3 shrink-0 text-neutral-400" aria-label="renamed to" />
              </>
            )}
            <span className="truncate" title={diff.path}>{diff.path}</span>
          </div>
          {label && <span className="chip bg-neutral-200/70 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-300">{label}</span>}
          {!diff.isBinary && (
            <span className="font-mono text-[11px] tabular-nums shrink-0">
              <span className="text-emerald-600 dark:text-emerald-400">+{diff.additions}</span>{' '}
              <span className="text-rose-600 dark:text-rose-400">−{diff.deletions}</span>
            </span>
          )}
          {onModeChange && !diff.isBinary && diff.hunks.length > 0 && (
            <div className="segmented shrink-0" role="group" aria-label="Diff layout">
              <button type="button" aria-pressed={mode === 'unified'} onClick={() => onModeChange('unified')} title="Unified" aria-label="Unified diff">
                <Rows3 className="w-3.5 h-3.5" />
              </button>
              <button type="button" aria-pressed={mode === 'split'} onClick={() => onModeChange('split')} title="Side by side" aria-label="Side-by-side diff">
                <Columns2 className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      )}

      {diff.isTruncated && (
        <div className="flex items-center gap-2 px-3 py-2 text-[11px] text-amber-800 dark:text-amber-300 bg-amber-50 dark:bg-amber-500/10 border-b border-amber-200/60 dark:border-amber-500/20">
          <FileWarning className="w-3.5 h-3.5 shrink-0" />
          Large diff truncated — only the first part is shown. Open the file in your editor to see everything.
        </div>
      )}

      {diff.isBinary ? (
        <div className="p-6 text-center text-xs text-neutral-500 dark:text-neutral-400">
          <p className="font-medium text-neutral-700 dark:text-neutral-300">Binary file</p>
          <p className="mt-1">Contents are not shown for binary files.</p>
        </div>
      ) : diff.hunks.length === 0 ? (
        <div className="p-6 text-center text-xs text-neutral-400">No textual changes.</div>
      ) : (
        <div className="overflow-x-auto selectable">
          <table className="w-full border-collapse font-mono text-[11.5px] leading-[1.6]">
            <tbody>
              {diff.hunks.map((hunk, hi) => (
                <React.Fragment key={hi}>
                  <tr>
                    <td
                      colSpan={4}
                      className="px-3 py-1 text-[11px] text-blue-700/80 dark:text-blue-300/80 bg-blue-50/70 dark:bg-blue-500/10 whitespace-pre"
                    >
                      {hunk.header}
                    </td>
                  </tr>
                  {mode === 'split'
                    ? toSplitRows(hunk).map((row, ri) => (
                        <tr key={ri}>
                          <SplitCells line={row.left} side="left" code={code} />
                          <SplitCells line={row.right} side="right" code={code} />
                        </tr>
                      ))
                    : hunk.lines.map((line, li) => (
                        <tr key={li} className={ROW_BG[line.type]}>
                          <td className={`w-10 px-2 text-right select-none tabular-nums ${GUTTER_BG[line.type]}`}>{line.oldLineNumber ?? ''}</td>
                          <td className={`w-10 px-2 text-right select-none tabular-nums ${GUTTER_BG[line.type]}`}>{line.newLineNumber ?? ''}</td>
                          <td className={`w-4 text-center select-none ${line.type === 'add' ? 'text-emerald-600' : line.type === 'delete' ? 'text-rose-600' : 'text-neutral-300'}`} aria-hidden="true">
                            {MARKER[line.type]}
                          </td>
                          <td className="pr-4 whitespace-pre text-neutral-800 dark:text-neutral-200">{code(line.content)}</td>
                        </tr>
                      ))}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

const SplitCells: React.FC<{
  line: DiffLine | null;
  side: 'left' | 'right';
  code: (t: string) => React.ReactNode;
}> = ({ line, side, code }) => {
  const border = side === 'right' ? 'border-l border-neutral-200 dark:border-neutral-800' : '';
  if (!line) {
    return (
      <>
        <td className={`w-10 bg-neutral-50 dark:bg-neutral-850 ${border}`} />
        <td className="w-1/2 bg-neutral-50 dark:bg-neutral-850" />
      </>
    );
  }
  const num = side === 'left' ? line.oldLineNumber : line.newLineNumber;
  return (
    <>
      <td className={`w-10 px-2 text-right select-none tabular-nums ${GUTTER_BG[line.type]} ${border}`}>{num ?? ''}</td>
      <td className={`w-1/2 px-2 whitespace-pre text-neutral-800 dark:text-neutral-200 ${ROW_BG[line.type]}`}>
        <span className="sr-only">{line.type === 'add' ? 'added: ' : line.type === 'delete' ? 'removed: ' : ''}</span>
        {code(line.content)}
      </td>
    </>
  );
};

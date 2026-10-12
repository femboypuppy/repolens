import React, { useMemo } from 'react';
import { Tag, GitBranch, Cloud } from 'lucide-react';
import type { GitCommit } from '../../types';
import { layoutGraph, laneColor, type GraphRow } from '../../utils/graph';
import { formatAbsolute, formatRelative } from '../../utils/time';

const ROW_H = 44;
const LANE_W = 14;
const MAX_LANES = 10;
const NODE_R = 4;

interface CommitGraphProps {
  commits: GitCommit[];
  selectedHash: string | null;
  onSelect: (commit: GitCommit) => void;
  /** Hashes hidden by a text filter; the graph still lays out the full list. */
  visible?: (commit: GitCommit) => boolean;
  remoteNames?: ReadonlySet<string>;
}

export type RefKind = 'head' | 'branch' | 'remote' | 'tag';
export interface ParsedRef {
  kind: RefKind;
  name: string;
}

/**
 * Turns git `%D` decorations into typed labels. A ref is treated as
 * remote-tracking when its first path segment is a configured remote name.
 */
export function parseRefs(refs: string[], remoteNames: ReadonlySet<string> = new Set(['origin'])): ParsedRef[] {
  const out: ParsedRef[] = [];
  for (const r of refs) {
    if (r.startsWith('HEAD -> ')) {
      out.push({ kind: 'head', name: 'HEAD' }, { kind: 'branch', name: r.slice(8) });
    } else if (r === 'HEAD') {
      out.push({ kind: 'head', name: 'HEAD' });
    } else if (r.startsWith('tag: ')) {
      out.push({ kind: 'tag', name: r.slice(5) });
    } else if (r.includes('/') && remoteNames.has(r.split('/')[0])) {
      if (!r.endsWith('/HEAD')) out.push({ kind: 'remote', name: r });
    } else {
      out.push({ kind: 'branch', name: r });
    }
  }
  return out;
}

const REF_STYLE: Record<RefKind, string> = {
  head: 'bg-blue-600 text-white',
  branch: 'bg-blue-50 text-blue-700 dark:bg-blue-500/15 dark:text-blue-300',
  remote: 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300',
  tag: 'bg-amber-50 text-amber-800 dark:bg-amber-500/15 dark:text-amber-300',
};

export const RefChips: React.FC<{ refs: string[]; remoteNames?: ReadonlySet<string> }> = ({ refs, remoteNames }) => {
  const parsed = parseRefs(refs, remoteNames);
  if (parsed.length === 0) return null;
  return (
    <span className="inline-flex flex-wrap gap-1 align-middle">
      {parsed.map((r, i) => (
        <span key={i} className={`chip ${REF_STYLE[r.kind]}`} title={r.name}>
          {r.kind === 'tag' && <Tag className="w-2.5 h-2.5" />}
          {r.kind === 'branch' && <GitBranch className="w-2.5 h-2.5" />}
          {r.kind === 'remote' && <Cloud className="w-2.5 h-2.5" />}
          <span className="max-w-[140px] truncate">{r.name}</span>
        </span>
      ))}
    </span>
  );
};

const x = (col: number) => LANE_W / 2 + 4 + Math.min(col, MAX_LANES - 1) * LANE_W;

function segment(fromCol: number, toCol: number, y1: number, y2: number): string {
  const x1 = x(fromCol);
  const x2 = x(toCol);
  if (x1 === x2) return `M${x1} ${y1}L${x2} ${y2}`;
  const my = (y1 + y2) / 2;
  return `M${x1} ${y1}C${x1} ${my} ${x2} ${my} ${x2} ${y2}`;
}

const GraphCell: React.FC<{ row: GraphRow; width: number }> = ({ row, width }) => {
  const mid = ROW_H / 2;
  return (
    <svg width={width} height={ROW_H} className="shrink-0" aria-hidden="true">
      {row.top.map((e, i) => (
        <path key={`t${i}`} d={segment(e.from, e.to, 0, mid)} stroke={laneColor(e.color)} strokeWidth={1.75} fill="none" strokeLinecap="round" />
      ))}
      {row.bottom.map((e, i) => (
        <path key={`b${i}`} d={segment(e.from, e.to, mid, ROW_H)} stroke={laneColor(e.color)} strokeWidth={1.75} fill="none" strokeLinecap="round" />
      ))}
      <circle
        cx={x(row.column)}
        cy={mid}
        r={NODE_R}
        fill={row.isMerge ? 'var(--graph-node-bg, white)' : laneColor(row.color)}
        stroke={laneColor(row.color)}
        strokeWidth={row.isMerge ? 2 : 1.5}
        className="[--graph-node-bg:white] dark:[--graph-node-bg:#171717]"
      />
    </svg>
  );
};

export const CommitGraph: React.FC<CommitGraphProps> = ({ commits, selectedHash, onSelect, visible, remoteNames }) => {
  const layout = useMemo(() => layoutGraph(commits), [commits]);
  const width = Math.min(layout.width, MAX_LANES) * LANE_W + 8;
  const filtering = !!visible;

  return (
    <ul role="listbox" aria-label="Commit history" className="select-none">
      {commits.map((c, i) => {
        if (visible && !visible(c)) return null;
        const selected = c.hash === selectedHash;
        return (
          <li
            key={c.hash}
            role="option"
            aria-selected={selected}
            tabIndex={0}
            onClick={() => onSelect(c)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(c);
              }
            }}
            className={`flex items-stretch gap-2 pr-3 cursor-default rounded-md transition-colors duration-150 ${
              selected ? 'bg-blue-50 dark:bg-blue-500/15' : 'hover:bg-neutral-100/80 dark:hover:bg-neutral-800/60'
            }`}
            style={{ height: ROW_H }}
          >
            {!filtering ? <GraphCell row={layout.rows[i]} width={width} /> : <span className="w-2" />}
            <div className="min-w-0 flex-1 flex flex-col justify-center">
              <div className="flex items-center gap-1.5 min-w-0">
                <RefChips refs={c.refs} remoteNames={remoteNames} />
                <span className="truncate text-xs font-medium text-neutral-800 dark:text-neutral-100" title={c.subject}>
                  {c.subject || <em className="text-neutral-400">(no message)</em>}
                </span>
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-neutral-500 dark:text-neutral-400 min-w-0">
                <span className="truncate">{c.author}</span>
                <span aria-hidden="true">Â·</span>
                <time dateTime={c.date} title={formatAbsolute(c.date)} className="shrink-0">
                  {formatRelative(c.date)}
                </time>
                <span aria-hidden="true">Â·</span>
                <span className="font-mono shrink-0">{c.shortHash}</span>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
};

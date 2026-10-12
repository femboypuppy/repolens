import type { DiffHunk, DiffLine, FileDiff } from '../types';

const HUNK_RE = /^@@ -(\d+)(?:,(\d+))? \+(\d+)(?:,(\d+))? @@(.*)$/;

/**
 * Parses the hunk section of a unified diff (starting at the first `@@` line)
 * into the same shape the Rust backend returns. Used for demo data only.
 */
export function parseUnifiedDiff(path: string, raw: string, oldPath: string | null = null): FileDiff {
  const hunks: DiffHunk[] = [];
  let current: DiffHunk | null = null;
  let oldNo = 0;
  let newNo = 0;
  let additions = 0;
  let deletions = 0;

  for (const text of raw.split('\n')) {
    const m = HUNK_RE.exec(text);
    if (m) {
      oldNo = Number(m[1]);
      newNo = Number(m[3]);
      current = {
        oldStart: oldNo,
        oldLines: m[2] === undefined ? 1 : Number(m[2]),
        newStart: newNo,
        newLines: m[4] === undefined ? 1 : Number(m[4]),
        header: text,
        lines: [],
      };
      hunks.push(current);
      continue;
    }
    if (!current) continue;
    const marker = text[0];
    const content = text.slice(1);
    let line: DiffLine;
    if (marker === '+') {
      line = { type: 'add', oldLineNumber: null, newLineNumber: newNo++, content };
      additions++;
    } else if (marker === '-') {
      line = { type: 'delete', oldLineNumber: oldNo++, newLineNumber: null, content };
      deletions++;
    } else if (marker === '\\') {
      continue; // "\ No newline at end of file"
    } else {
      line = { type: 'context', oldLineNumber: oldNo++, newLineNumber: newNo++, content };
    }
    current.lines.push(line);
  }

  return { path, oldPath, isBinary: false, isTruncated: false, additions, deletions, hunks };
}

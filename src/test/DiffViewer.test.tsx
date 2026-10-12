import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { DiffViewer, toSplitRows } from '../components/DiffViewer';
import type { FileDiff, DiffHunk } from '../types';

describe('DiffViewer Component', () => {
  const sampleDiff: FileDiff = {
    path: 'src/components/DiffViewer.tsx',
    oldPath: null,
    isBinary: false,
    isTruncated: false,
    additions: 1,
    deletions: 1,
    hunks: [
      {
        oldStart: 10,
        oldLines: 2,
        newStart: 10,
        newLines: 2,
        header: '@@ -10,2 +10,2 @@',
        lines: [
          { type: 'delete', oldLineNumber: 10, newLineNumber: null, content: 'const a = 1;' },
          { type: 'add', oldLineNumber: null, newLineNumber: 10, content: 'const a = 2;' },
        ],
      },
    ],
  };

  it('renders diff lines with additions, deletions and line numbers in unified mode', () => {
    render(<DiffViewer diff={sampleDiff} mode="unified" label="Staged" />);

    expect(screen.getByText('src/components/DiffViewer.tsx')).toBeInTheDocument();
    expect(screen.getByText('Staged')).toBeInTheDocument();
    expect(screen.getAllByText('const').length).toBeGreaterThan(0);
    expect(screen.getByText('+1')).toBeInTheDocument();
    expect(screen.getByText('−1')).toBeInTheDocument();
  });

  it('pairs additions and deletions cleanly in split layout helper', () => {
    const hunk: DiffHunk = {
      oldStart: 1,
      oldLines: 3,
      newStart: 1,
      newLines: 3,
      header: '@@ -1,3 +1,3 @@',
      lines: [
        { type: 'context', oldLineNumber: 1, newLineNumber: 1, content: 'context' },
        { type: 'delete', oldLineNumber: 2, newLineNumber: null, content: 'old line' },
        { type: 'add', oldLineNumber: null, newLineNumber: 2, content: 'new line' },
      ],
    };

    const rows = toSplitRows(hunk);
    expect(rows.length).toBe(2);
    expect(rows[0].left?.content).toBe('context');
    expect(rows[0].right?.content).toBe('context');
    expect(rows[1].left?.content).toBe('old line');
    expect(rows[1].right?.content).toBe('new line');
  });

  it('renders binary file fallback appropriately', () => {
    const binaryDiff: FileDiff = {
      path: 'assets/image.png',
      oldPath: null,
      isBinary: true,
      isTruncated: false,
      additions: 0,
      deletions: 0,
      hunks: [],
    };

    render(<DiffViewer diff={binaryDiff} mode="unified" />);
    expect(screen.getByText('Binary file')).toBeInTheDocument();
    expect(screen.getByText('Contents are not shown for binary files.')).toBeInTheDocument();
  });

  it('renders truncation banner when diff exceeds limit', () => {
    const truncatedDiff: FileDiff = {
      ...sampleDiff,
      isTruncated: true,
    };

    render(<DiffViewer diff={truncatedDiff} mode="unified" />);
    expect(screen.getByText(/Large diff truncated/i)).toBeInTheDocument();
  });
});

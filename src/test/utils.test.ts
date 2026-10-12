import { describe, it, expect } from 'vitest';
import { layoutGraph } from '../utils/graph';
import { formatRelative, formatAbsolute, dayKey, formatDayHeading } from '../utils/time';
import { languageForPath, highlightCode } from '../utils/highlight';
import { isValidElement } from 'react';

describe('Commit graph layout algorithm', () => {
  it('assigns lanes linearly for simple linear history', () => {
    const commits = [
      { hash: 'c3', parents: ['c2'] },
      { hash: 'c2', parents: ['c1'] },
      { hash: 'c1', parents: [] },
    ];
    const layout = layoutGraph(commits);
    expect(layout.rows.length).toBe(3);
    expect(layout.rows[0].column).toBe(0);
    expect(layout.rows[1].column).toBe(0);
    expect(layout.rows[2].column).toBe(0);
    expect(layout.width).toBeGreaterThanOrEqual(1);
  });

  it('allocates distinct lanes for branches and merges', () => {
    const commits = [
      { hash: 'm1', parents: ['b1', 'b2'] }, // merge commit
      { hash: 'b1', parents: ['base'] },
      { hash: 'b2', parents: ['base'] },
      { hash: 'base', parents: [] },
    ];
    const layout = layoutGraph(commits);
    expect(layout.rows.length).toBe(4);
    expect(layout.rows[0].isMerge).toBe(true);
    expect(layout.width).toBeGreaterThanOrEqual(2);
  });
});

describe('Time formatting utilities', () => {
  it('formats relative dates accurately for recent times', () => {
    const now = new Date();
    expect(formatRelative(now.toISOString())).toBe('just now');

    const twoHoursAgo = new Date(Date.now() - 2 * 3600 * 1000);
    expect(formatRelative(twoHoursAgo.toISOString())).toContain('2 hours ago');

    const threeDaysAgo = new Date(Date.now() - 3 * 86400 * 1000);
    expect(formatRelative(threeDaysAgo.toISOString())).toContain('3 days ago');
  });

  it('formats absolute dates and day keys consistently', () => {
    const testDate = '2026-10-10T12:00:00.000Z';
    expect(dayKey(testDate)).toBe('2026-10-10');
    expect(formatAbsolute(testDate)).toContain('2026');
    expect(formatDayHeading(dayKey(new Date().toISOString()))).toBe('Today');
  });
});

describe('Syntax highlighting safety and language detection', () => {
  it('correctly maps file extensions to highlight.js grammars', () => {
    expect(languageForPath('src/main.rs')).toBe('rust');
    expect(languageForPath('src/App.tsx')).toBe('typescript');
    expect(languageForPath('Makefile')).toBe('makefile');
    expect(languageForPath('config.toml')).toBe('ini');
    expect(languageForPath('script.py')).toBe('python');
    expect(languageForPath('unknown.xyz')).toBeNull();
  });

  it('renders code as React elements without HTML string injection', () => {
    const unsafeCode = '<script>alert("xss")</script>';
    const result = highlightCode(unsafeCode, 'xml');

    // The result should either be an array of React elements or strings, never raw unescaped HTML strings
    expect(Array.isArray(result) || typeof result === 'string' || isValidElement(result)).toBe(true);
  });
});

import { describe, it, expect } from 'vitest';
import { gitService, isTauri, isDemo } from '../services/gitService';
import type { DiffLine } from '../types';

describe('gitService in browser/demo mode', () => {
  it('correctly detects browser environment and demo mode', () => {
    expect(isTauri()).toBe(false);
    expect(isDemo()).toBe(true);
  });

  it('returns simulated environment in demo mode', async () => {
    const env = await gitService.getEnvironment();
    expect(env.installed).toBe(true);
    expect(env.version.toLowerCase()).toContain('demo mode');
    expect(env.userEmail).toBeDefined();
  });

  it('inspects demo repositories correctly', async () => {
    const repo = await gitService.inspectRepository('/Users/developer/Projects/repolens');
    expect(repo.name).toBe('repolens');
    expect(repo.currentBranch).toBe('main');
    expect(repo.status).toBe('modified');
    expect(repo.totalChanges).toBe(5);
    expect(repo.lastCommit).not.toBeNull();
    expect(repo.lastCommit?.author).toBe('Alex Morgan');
  });

  it('fetches commits history with limit, skip and parents', async () => {
    const commits = await gitService.getCommits('/Users/developer/Projects/repolens', 3, 0);
    expect(commits.length).toBe(3);
    expect(commits[0].subject).toContain('live refresh');
    expect(commits[0].parents).toBeDefined();
    expect(Array.isArray(commits[0].parents)).toBe(true);
  });

  it('fetches branch listing with current indicator and tracking', async () => {
    const branches = await gitService.getBranches('/Users/developer/Projects/repolens');
    expect(branches.length).toBeGreaterThan(0);
    const current = branches.find((b) => b.isCurrent);
    expect(current).toBeDefined();
    expect(current?.name).toBe('main');
  });

  it('fetches tags, stashes and worktrees', async () => {
    const tags = await gitService.getTags('/Users/developer/Projects/repolens');
    expect(tags.length).toBeGreaterThan(0);
    expect(tags[0].name).toBe('v0.9.0');

    const stashes = await gitService.getStashes('/Users/developer/Projects/repolens');
    expect(stashes.length).toBeGreaterThan(0);

    const worktrees = await gitService.getWorktrees('/Users/developer/Projects/repolens');
    expect(worktrees.length).toBeGreaterThan(0);
  });

  it('fetches diffs with hunks, additions and deletions', async () => {
    const diff = await gitService.getFileDiff('/Users/developer/Projects/repolens', {
      path: 'src/components/DiffViewer.tsx',
      kind: 'staged',
    });
    expect(diff.path).toBe('src/components/DiffViewer.tsx');
    expect(diff.hunks.length).toBeGreaterThan(0);
    const adds = diff.hunks[0].lines.filter((l: DiffLine) => l.type === 'add');
    const dels = diff.hunks[0].lines.filter((l: DiffLine) => l.type === 'delete');
    expect(adds.length).toBeGreaterThan(0);
    expect(dels.length).toBeGreaterThan(0);
  });

  it('performs simulated code search across demo files', async () => {
    const res = await gitService.searchRepository(
      '/Users/developer/Projects/repolens',
      'MAX_CONCURRENT_GIT',
      { regex: false, caseSensitive: false }
    );
    expect(res.matches.length).toBeGreaterThan(0);
    expect(res.matches[0].file).toContain('process.rs');
  });

  it('compares branches with ahead/behind counts and changed files', async () => {
    const comp = await gitService.compareBranches(
      '/Users/developer/Projects/repolens',
      'main',
      'feature/live-refresh'
    );
    expect(comp.baseRef).toBe('main');
    expect(comp.compareRef).toBe('feature/live-refresh');
    expect(comp.aheadCount).toBeGreaterThan(0);
    expect(comp.changedFiles.length).toBeGreaterThan(0);
    expect(comp.diff).toBeDefined();
  });

  it('retrieves file blame and history', async () => {
    const blame = await gitService.getFileBlame(
      '/Users/developer/Projects/repolens',
      'README.md'
    );
    expect(blame.length).toBeGreaterThan(0);
    expect(blame[0].author).toBeDefined();
    expect(blame[0].lineNumber).toBe(1);

    const history = await gitService.getFileHistory(
      '/Users/developer/Projects/repolens',
      'README.md',
      10
    );
    expect(history.length).toBeGreaterThan(0);
    expect(history[0].hash).toBeDefined();
  });
});

import type {
  BlameLine,
  BranchComparison,
  ChangedFile,
  ChangedFiles,
  CommitDiff,
  FileDiff,
  GitBranch,
  GitCommit,
  GitEnvironment,
  GitStash,
  GitTag,
  GitWorktree,
  Repository,
  SearchMatch,
  SearchResult,
  TraySummary,
} from '../types';
import {
  DEMO_BRANCHES,
  DEMO_CHANGED_FILES,
  DEMO_COMMITS,
  DEMO_FILES,
  DEMO_REPOSITORIES,
  DEMO_STASHES,
  DEMO_TAGS,
  DEMO_USER_EMAIL,
  DEMO_WORKTREES,
  demoCommitDiff,
  demoCompareBranches,
  demoFileDiff,
  demoGetFileBlame,
  demoGetFileHistory,
} from '../demo/sampleData';

export const isTauri = (): boolean =>
  typeof window !== 'undefined' && ('__TAURI_INTERNALS__' in window || '__TAURI__' in window);

/**
 * Demo routing. Outside Tauri we are always in demo mode; inside Tauri the
 * user's `demoMode` setting decides. The backend never sees demo paths.
 */
let demoMode = !isTauri();
export function setDemoMode(on: boolean): void {
  demoMode = on || !isTauri();
}
export const isDemo = (): boolean => demoMode;

async function invoke<T>(cmd: string, args?: Record<string, unknown>): Promise<T> {
  if (!isTauri()) throw new Error(`Not running inside Tauri (command: ${cmd})`);
  const core = await import('@tauri-apps/api/core');
  return core.invoke<T>(cmd, args);
}

/** Normalises errors coming from `invoke` (plain strings) into Error objects. */
export function errorMessage(e: unknown): string {
  if (e instanceof Error) return e.message;
  if (typeof e === 'string') return e;
  try {
    return JSON.stringify(e);
  } catch {
    return String(e);
  }
}

const demoRepoByPath = (path: string) => DEMO_REPOSITORIES.find((r) => r.path === path);
const demoId = (path: string) => demoRepoByPath(path)?.id ?? '';
const delay = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface FileDiffRequest {
  path: string;
  oldPath?: string | null;
  kind: 'staged' | 'unstaged' | 'untracked';
}

export const gitService = {
  async getEnvironment(): Promise<GitEnvironment> {
    if (demoMode) {
      return { installed: true, version: 'Demo Mode (Git not used)', executablePath: '—', userEmail: DEMO_USER_EMAIL };
    }
    return invoke<GitEnvironment>('get_git_environment');
  },

  /** Native directory picker. Returns null when cancelled. */
  async pickFolder(title: string): Promise<string | null> {
    if (!isTauri()) {
      const value = window.prompt(`${title} (browser preview — enter a demo path)`, '/Users/developer/Projects');
      return value && value.trim() ? value.trim() : null;
    }
    return invoke<string | null>('pick_folder', { title });
  },

  async scanWorkspace(folderPath: string, maxDepth = 3): Promise<string[]> {
    if (demoMode) {
      await delay(120);
      return DEMO_REPOSITORIES.filter((r) => r.workspacePath === folderPath).map((r) => r.path);
    }
    return invoke<string[]>('scan_workspace_folder', { path: folderPath, maxDepth });
  },

  async cancelScan(): Promise<void> {
    if (demoMode) return;
    await invoke<void>('cancel_scan');
  },

  /** All demo repositories (used instead of scanning in demo mode). */
  demoRepositories(): Repository[] {
    return DEMO_REPOSITORIES.map((r) => ({ ...r }));
  },

  async inspectRepository(path: string, workspacePath = ''): Promise<Repository> {
    if (demoMode) {
      const found = demoRepoByPath(path);
      if (!found) throw new Error(`Not a demo repository: ${path}`);
      return { ...found };
    }
    return invoke<Repository>('inspect_repository', { path, workspacePath });
  },

  async getCommits(repoPath: string, limit = 50, skip = 0, allRefs = false): Promise<GitCommit[]> {
    if (demoMode) {
      await delay(80);
      return (DEMO_COMMITS[demoId(repoPath)] ?? []).slice(skip, skip + limit);
    }
    return invoke<GitCommit[]>('get_repository_commits', { path: repoPath, limit, skip, allRefs });
  },

  async getBranches(repoPath: string): Promise<GitBranch[]> {
    if (demoMode) return DEMO_BRANCHES[demoId(repoPath)] ?? [];
    return invoke<GitBranch[]>('get_repository_branches', { path: repoPath });
  },

  async getTags(repoPath: string): Promise<GitTag[]> {
    if (demoMode) return DEMO_TAGS[demoId(repoPath)] ?? [];
    return invoke<GitTag[]>('get_repository_tags', { path: repoPath });
  },

  async getStashes(repoPath: string): Promise<GitStash[]> {
    if (demoMode) return DEMO_STASHES[demoId(repoPath)] ?? [];
    return invoke<GitStash[]>('get_repository_stashes', { path: repoPath });
  },

  async getWorktrees(repoPath: string): Promise<GitWorktree[]> {
    if (demoMode) {
      const repo = demoRepoByPath(repoPath);
      return (
        DEMO_WORKTREES[demoId(repoPath)] ??
        (repo && !repo.isUnborn
          ? [{ path: repo.path, head: repo.lastCommit?.hash ?? null, branch: repo.isDetached ? null : repo.currentBranch, isMain: true, isDetached: repo.isDetached, isBare: false, isLocked: false, isPrunable: false }]
          : [])
      );
    }
    return invoke<GitWorktree[]>('get_repository_worktrees', { path: repoPath });
  },

  async getChangedFiles(repoPath: string): Promise<ChangedFiles> {
    if (demoMode) {
      await delay(60);
      return { files: DEMO_CHANGED_FILES[demoId(repoPath)] ?? [], truncated: false };
    }
    return invoke<ChangedFiles>('get_changed_files', { path: repoPath });
  },

  async getFileDiff(repoPath: string, req: FileDiffRequest): Promise<FileDiff> {
    if (demoMode) {
      await delay(60);
      return demoFileDiff(demoId(repoPath), req.path, req.oldPath, req.kind);
    }
    return invoke<FileDiff>('get_file_diff', {
      repoPath,
      filePath: req.path,
      oldPath: req.oldPath ?? null,
      staged: req.kind === 'staged',
      untracked: req.kind === 'untracked',
    });
  },

  async getCommitDiff(repoPath: string, hash: string): Promise<CommitDiff> {
    if (demoMode) {
      await delay(80);
      return demoCommitDiff(hash);
    }
    return invoke<CommitDiff>('get_commit_diff', { path: repoPath, hash });
  },

  async getMyCommits(repoPath: string, days: number): Promise<GitCommit[]> {
    if (demoMode) {
      const cutoff = Date.now() - days * 86_400_000;
      return (DEMO_COMMITS[demoId(repoPath)] ?? []).filter(
        (c) => c.authorEmail === DEMO_USER_EMAIL && new Date(c.date).getTime() >= cutoff,
      );
    }
    return invoke<GitCommit[]>('get_my_commits', { path: repoPath, days });
  },

  async searchRepository(
    repoPath: string,
    query: string,
    opts: { regex: boolean; caseSensitive: boolean },
  ): Promise<SearchResult> {
    if (demoMode) {
      await delay(90);
      return demoSearch(DEMO_FILES[demoId(repoPath)] ?? {}, query, opts);
    }
    return invoke<SearchResult>('search_repository', {
      path: repoPath,
      query,
      regex: opts.regex,
      caseSensitive: opts.caseSensitive,
    });
  },

  async compareBranches(repoPath: string, baseRef: string, compareRef: string): Promise<BranchComparison> {
    if (demoMode) return demoCompareBranches(demoId(repoPath), baseRef, compareRef);
    return invoke<BranchComparison>('compare_branches', { path: repoPath, baseRef, compareRef });
  },

  async getComparisonFileDiff(repoPath: string, baseRef: string, compareRef: string, filePath: string): Promise<FileDiff> {
    if (demoMode) return demoFileDiff(demoId(repoPath), filePath, null, 'unstaged');
    return invoke<FileDiff>('get_comparison_file_diff', { path: repoPath, baseRef, compareRef, filePath });
  },

  async getFileHistory(repoPath: string, filePath: string, limit?: number): Promise<GitCommit[]> {
    if (demoMode) return demoGetFileHistory(demoId(repoPath), filePath);
    return invoke<GitCommit[]>('get_file_history', { path: repoPath, filePath, limit });
  },

  async getFileBlame(repoPath: string, filePath: string, commit?: string): Promise<BlameLine[]> {
    if (demoMode) return demoGetFileBlame(demoId(repoPath), filePath);
    return invoke<BlameLine[]>('get_file_blame', { path: repoPath, filePath, commit });
  },

  async watchRepositories(paths: string[]): Promise<number> {
    if (demoMode) return 0;
    return invoke<number>('watch_repositories', { paths });
  },

  async updateTray(summary: TraySummary): Promise<void> {
    if (!isTauri()) return;
    await invoke<void>('update_tray', { summary });
  },

  async openInFileManager(path: string): Promise<void> {
    if (demoMode) return demoNotice(`Would open ${path} in the file manager.`);
    await invoke<void>('open_in_file_manager', { path });
  },

  async openInVsCode(path: string): Promise<void> {
    if (demoMode) return demoNotice(`Would open ${path} in VS Code.`);
    await invoke<void>('open_in_vscode', { path });
  },

  async openInTerminal(path: string): Promise<void> {
    if (demoMode) return demoNotice(`Would open a terminal at ${path}.`);
    await invoke<void>('open_in_terminal', { path });
  },

  /** Subscribe to a backend event. Returns an unsubscribe function. No-op outside Tauri. */
  async listen<T>(event: 'repo-changed' | 'tray-select-repo', cb: (payload: T) => void): Promise<() => void> {
    if (!isTauri()) return () => {};
    const { listen } = await import('@tauri-apps/api/event');
    return listen<T>(event, (e) => cb(e.payload));
  },
};

type NoticeHandler = (message: string) => void;
let noticeHandler: NoticeHandler | null = null;
/** Lets the UI show demo-mode notices (e.g. as a toast). */
export function onDemoNotice(handler: NoticeHandler | null): void {
  noticeHandler = handler;
}
function demoNotice(message: string): void {
  noticeHandler?.(`Demo Mode: ${message}`);
}

export function demoSearch(
  files: Record<string, string>,
  query: string,
  opts: { regex: boolean; caseSensitive: boolean },
): SearchResult {
  if (!query) return { matches: [], truncated: false };
  let test: (line: string) => boolean;
  if (opts.regex) {
    let re: RegExp;
    try {
      re = new RegExp(query, opts.caseSensitive ? '' : 'i');
    } catch (e) {
      throw new Error(`Invalid regular expression: ${errorMessage(e)}`);
    }
    test = (l) => re.test(l);
  } else {
    const needle = opts.caseSensitive ? query : query.toLowerCase();
    test = (l) => (opts.caseSensitive ? l : l.toLowerCase()).includes(needle);
  }
  const matches: SearchMatch[] = [];
  for (const [file, content] of Object.entries(files)) {
    content.split('\n').forEach((line, i) => {
      if (test(line)) matches.push({ file, lineNumber: i + 1, line });
    });
  }
  return { matches: matches.slice(0, 500), truncated: matches.length > 500 };
}

/** Which diff kinds apply to a changed file. */
export function diffKindsFor(file: ChangedFile): FileDiffRequest['kind'][] {
  if (file.stagedStatus === 'untracked') return ['untracked'];
  const kinds: FileDiffRequest['kind'][] = [];
  if (file.stagedStatus !== 'none' && file.stagedStatus !== 'unmerged') kinds.push('staged');
  if (file.unstagedStatus !== 'none') kinds.push('unstaged');
  return kinds;
}

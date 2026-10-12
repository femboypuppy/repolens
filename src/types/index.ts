export interface CommitSummary {
  hash: string;
  shortHash: string;
  subject: string;
  author: string;
  authorEmail: string;
  /** ISO 8601 */
  date: string;
}

export interface GitCommit extends CommitSummary {
  parents: string[];
  body: string;
  refs: string[];
}

export interface GitBranch {
  name: string;
  isCurrent: boolean;
  upstream: string | null;
  upstreamGone: boolean;
  ahead: number;
  behind: number;
  lastCommitDate: string;
  lastCommitSubject: string;
}

export interface GitTag {
  name: string;
  target: string;
  date: string;
  subject: string;
}

export interface GitStash {
  reference: string;
  hash: string;
  message: string;
  date: string;
}

export interface GitWorktree {
  path: string;
  head: string | null;
  branch: string | null;
  isMain: boolean;
  isDetached: boolean;
  isBare: boolean;
  isLocked: boolean;
  isPrunable: boolean;
}

export interface GitRemote {
  name: string;
  url: string;
  direction: 'fetch' | 'push';
}

export type FileChangeStatus =
  | 'modified'
  | 'added'
  | 'deleted'
  | 'renamed'
  | 'copied'
  | 'typechange'
  | 'unmerged'
  | 'untracked'
  | 'none';

export interface ChangedFile {
  path: string;
  oldPath?: string | null;
  stagedStatus: FileChangeStatus;
  unstagedStatus: FileChangeStatus;
}

export interface ChangedFiles {
  files: ChangedFile[];
  truncated: boolean;
}

export interface DiffLine {
  type: 'add' | 'delete' | 'context';
  oldLineNumber: number | null;
  newLineNumber: number | null;
  /** Line text without the leading +/-/space marker. */
  content: string;
}

export interface DiffHunk {
  oldStart: number;
  oldLines: number;
  newStart: number;
  newLines: number;
  header: string;
  lines: DiffLine[];
}

export interface FileDiff {
  path: string;
  oldPath?: string | null;
  isBinary: boolean;
  isTruncated: boolean;
  additions: number;
  deletions: number;
  hunks: DiffHunk[];
}

export interface CommitDiff {
  hash: string;
  files: FileDiff[];
  isTruncated: boolean;
}

export interface SearchMatch {
  file: string;
  lineNumber: number;
  line: string;
}

export interface SearchResult {
  matches: SearchMatch[];
  truncated: boolean;
}

export interface ChangedFileSummary {
  path: string;
  oldPath?: string | null;
  status: string;
  additions: number;
  deletions: number;
}

export interface BranchComparison {
  baseRef: string;
  compareRef: string;
  aheadCount: number;
  behindCount: number;
  aheadCommits: GitCommit[];
  behindCommits: GitCommit[];
  changedFiles: ChangedFileSummary[];
  diff?: string | null;
}

export interface BlameLine {
  lineNumber: number;
  commitHash: string;
  author: string;
  authorEmail: string;
  timestamp: number;
  summary: string;
  content: string;
}

export interface Repository {
  id: string;
  name: string;
  path: string;
  workspacePath: string;
  isFavorite: boolean;
  currentBranch: string;
  isDetached: boolean;
  isUnborn: boolean;
  status: 'clean' | 'modified';
  stagedCount: number;
  unstagedCount: number;
  untrackedCount: number;
  conflictedCount: number;
  totalChanges: number;
  lastCommit: CommitSummary | null;
  aheadCount: number;
  behindCount: number;
  hasUpstream: boolean;
  upstreamBranch: string | null;
  localOnlyCommits: number;
  stashCount: number;
  remotes: GitRemote[];
  isAccessible: boolean;
  errorMessage?: string | null;
}

export type DiffViewMode = 'unified' | 'split';

export interface AppSettings {
  theme: 'system' | 'light' | 'dark';
  enableTransparency: boolean;
  workspaceFolders: string[];
  directRepositories: string[];
  favorites: string[];
  /** repository id -> user labels */
  repoTags: Record<string, string[]>;
  maxScanDepth: number;
  sidebarWidth: number;
  detailWidth: number;
  compactMode: boolean;
  demoMode: boolean;
  liveRefresh: boolean;
  diffViewMode: DiffViewMode;
}

export interface GitEnvironment {
  installed: boolean;
  version: string;
  executablePath: string;
  userEmail?: string | null;
}

export type FilterCategory =
  | 'all'
  | 'favorites'
  | 'changes'
  | 'unpushed'
  | { folder: string }
  | { tag: string };

export type MainView = 'repositories' | 'activity' | 'search';

export type SortField = 'name' | 'recentCommit' | 'changes' | 'branch';
export type SortDirection = 'asc' | 'desc';

export interface TraySummary {
  changedCount: number;
  unpushedCount: number;
  repos: { id: string; name: string; changes: number }[];
}

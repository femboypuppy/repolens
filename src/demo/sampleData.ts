/**
 * Demo dataset used when RepoLens runs in Demo Mode (or in a plain browser).
 * Everything here is fictional. Nothing touches the filesystem or Git.
 */
import type {
  ChangedFile,
  CommitDiff,
  FileDiff,
  GitBranch,
  GitCommit,
  GitStash,
  GitTag,
  GitWorktree,
  Repository,
} from '../types';
import { parseUnifiedDiff } from './diffText';

export const DEMO_USER_EMAIL = 'alex.morgan@repolens.dev';
export const DEMO_ROOT = '/Users/developer/Projects';
export const DEMO_WORK_ROOT = '/Users/developer/Work';

const HOUR = 3_600_000;
const ago = (hours: number) => new Date(Date.now() - hours * HOUR).toISOString();

/** Deterministic 40-char hex "hash" derived from a seed string. */
export function fakeHash(seed: string): string {
  let h1 = 0x811c9dc5;
  let out = '';
  for (let round = 0; out.length < 40; round++) {
    for (let i = 0; i < seed.length; i++) {
      h1 ^= seed.charCodeAt(i) + round;
      h1 = Math.imul(h1, 0x01000193) >>> 0;
    }
    out += h1.toString(16).padStart(8, '0');
  }
  return out.slice(0, 40);
}

const PEOPLE = {
  alex: { author: 'Alex Morgan', authorEmail: DEMO_USER_EMAIL },
  sophia: { author: 'Sophia Chen', authorEmail: 'sophia@design.io' },
  devon: { author: 'Devon Vance', authorEmail: 'devon@vance.net' },
  marcus: { author: 'Marcus Lindqvist', authorEmail: 'marcus@kernel.org' },
} as const;
type Person = keyof typeof PEOPLE;

interface CommitSpec {
  id: string;
  parents: string[];
  subject: string;
  who: Person;
  hoursAgo: number;
  refs?: string[];
  body?: string;
}

function buildCommits(repoKey: string, specs: CommitSpec[]): GitCommit[] {
  const hashOf = (id: string) => fakeHash(`${repoKey}:${id}`);
  return specs.map((s) => {
    const hash = hashOf(s.id);
    return {
      hash,
      shortHash: hash.slice(0, 7),
      parents: s.parents.map(hashOf),
      subject: s.subject,
      body: s.body ?? '',
      ...PEOPLE[s.who],
      date: ago(s.hoursAgo),
      refs: s.refs ?? [],
    };
  });
}

// ---------------------------------------------------------------------------
// Commit histories (newest first, topo order)
// ---------------------------------------------------------------------------

const repolensCommits = buildCommits('repolens', [
  { id: 'c14', parents: ['c13'], subject: 'feat: live refresh via filesystem watcher', who: 'alex', hoursAgo: 1.5, refs: ['HEAD -> main'], body: 'Debounce change events and re-inspect only the affected repository.' },
  { id: 'c13', parents: ['c12', 'f3'], subject: "Merge branch 'feature/diff-viewer'", who: 'alex', hoursAgo: 3, refs: ['origin/main'] },
  { id: 'f3', parents: ['f2'], subject: 'feat(diff): side-by-side mode with syntax highlighting', who: 'sophia', hoursAgo: 5, refs: ['origin/feature/diff-viewer', 'feature/diff-viewer'] },
  { id: 'c12', parents: ['c11'], subject: 'fix: handle detached HEAD in status parser', who: 'devon', hoursAgo: 8 },
  { id: 'f2', parents: ['f1'], subject: 'feat(diff): render binary and truncated states', who: 'sophia', hoursAgo: 20 },
  { id: 'c11', parents: ['c10'], subject: 'perf: bound concurrent git subprocesses', who: 'alex', hoursAgo: 26, body: 'A global semaphore keeps at most six git processes running.' },
  { id: 'f1', parents: ['c10'], subject: 'refactor(diff): extract hunk table component', who: 'sophia', hoursAgo: 30 },
  { id: 'c10', parents: ['c9'], subject: 'chore(release): v0.9.0', who: 'alex', hoursAgo: 50, refs: ['tag: v0.9.0'] },
  { id: 'c9', parents: ['c8', 'w2'], subject: "Merge branch 'fix/windows-paths'", who: 'alex', hoursAgo: 52 },
  { id: 'w2', parents: ['w1'], subject: 'fix: normalise UNC prefixes with dunce', who: 'devon', hoursAgo: 55, refs: ['fix/windows-paths'] },
  { id: 'c8', parents: ['c7'], subject: 'feat: tray menu with changed-repository summary', who: 'alex', hoursAgo: 60 },
  { id: 'w1', parents: ['c7'], subject: 'test: paths with spaces and Unicode on Windows', who: 'devon', hoursAgo: 70 },
  { id: 'c7', parents: ['c6'], subject: 'feat: cross-repository search with git grep', who: 'alex', hoursAgo: 80 },
  { id: 'c6', parents: ['c5'], subject: 'docs: architecture overview in README', who: 'sophia', hoursAgo: 100 },
  { id: 'c5', parents: ['c4'], subject: 'fix: skip node_modules and target during discovery', who: 'devon', hoursAgo: 130 },
  { id: 'c4', parents: ['c3'], subject: 'feat: porcelain v2 status parser', who: 'alex', hoursAgo: 150 },
  { id: 'c3', parents: ['c2'], subject: 'chore(release): v0.1.0', who: 'alex', hoursAgo: 200, refs: ['tag: v0.1.0'] },
  { id: 'c2', parents: ['c1'], subject: 'feat: repository list with favorites', who: 'alex', hoursAgo: 230 },
  { id: 'c1', parents: [], subject: 'chore: initial project scaffold with Tauri v2, React, and Tailwind', who: 'alex', hoursAgo: 260 },
]);

const designCommits = buildCommits('design-system', [
  { id: 'd9', parents: ['d8'], subject: 'style: refine tab indicator easing', who: 'sophia', hoursAgo: 5, refs: ['HEAD -> feature/liquid-glass'] },
  { id: 'd8', parents: ['d7'], subject: 'feat(tokens): translucent surface tokens', who: 'alex', hoursAgo: 22 },
  { id: 'd7', parents: ['d6'], subject: 'feat(tokens): add focus ring tokens', who: 'sophia', hoursAgo: 30, refs: ['origin/feature/liquid-glass'] },
  { id: 'm2', parents: ['d5'], subject: 'fix(button): pressed state contrast', who: 'devon', hoursAgo: 34, refs: ['origin/main', 'main'] },
  { id: 'd6', parents: ['d5'], subject: 'feat: sidebar material component', who: 'sophia', hoursAgo: 40 },
  { id: 'd5', parents: ['d4'], subject: 'chore(release): 2.4.0', who: 'sophia', hoursAgo: 90, refs: ['tag: v2.4.0'] },
  { id: 'd4', parents: ['d3'], subject: 'feat(select): keyboard navigation', who: 'alex', hoursAgo: 120 },
  { id: 'd3', parents: ['d2'], subject: 'fix(tooltip): respect reduced motion', who: 'devon', hoursAgo: 160 },
  { id: 'd2', parents: ['d1'], subject: 'feat: initial component set', who: 'sophia', hoursAgo: 300 },
  { id: 'd1', parents: [], subject: 'chore: bootstrap design system', who: 'sophia', hoursAgo: 340 },
]);

const tailwindCommits = buildCommits('tailwind-preset', [
  { id: 't4', parents: ['t3'], subject: 'chore: update theme colour mapping for high contrast', who: 'devon', hoursAgo: 28, refs: ['HEAD -> v4-migration', 'origin/v4-migration'] },
  { id: 't3', parents: ['t2'], subject: 'feat: v4 CSS-first configuration', who: 'devon', hoursAgo: 75 },
  { id: 't2', parents: ['t1'], subject: 'feat: neutral palette', who: 'alex', hoursAgo: 140 },
  { id: 't1', parents: [], subject: 'chore: initial preset', who: 'devon', hoursAgo: 400 },
]);

const kernelCommits = buildCommits('kernel-driver', [
  { id: 'k5', parents: ['k4'], subject: 'wip: experiment with lock-free ring', who: 'alex', hoursAgo: 46 },
  { id: 'k4', parents: ['k3'], subject: 'fix(dma): resolve race in buffer ring wrap-around', who: 'marcus', hoursAgo: 72, refs: ['HEAD'] },
  { id: 'k3', parents: ['k2'], subject: 'feat(dma): scatter-gather support', who: 'marcus', hoursAgo: 150, refs: ['tag: v6.1-rc2'] },
  { id: 'k2', parents: ['k1'], subject: 'refactor: split irq handler', who: 'marcus', hoursAgo: 260 },
  { id: 'k1', parents: [], subject: 'initial driver skeleton', who: 'marcus', hoursAgo: 500 },
]);

const dotfilesCommits = buildCommits('dotfiles', [
  { id: 'o4', parents: ['o3'], subject: 'zsh: faster prompt with async git status', who: 'alex', hoursAgo: 18, refs: ['HEAD -> main'] },
  { id: 'o3', parents: ['o2'], subject: 'nvim: switch to lazy.nvim', who: 'alex', hoursAgo: 44 },
  { id: 'o2', parents: ['o1'], subject: 'git: add useful aliases', who: 'alex', hoursAgo: 98 },
  { id: 'o1', parents: [], subject: 'initial dotfiles', who: 'alex', hoursAgo: 700 },
]);

export const DEMO_COMMITS: Record<string, GitCommit[]> = {
  'repo-repolens': repolensCommits,
  'repo-design-system': designCommits,
  'repo-tailwind-preset': tailwindCommits,
  'repo-kernel-driver': kernelCommits,
  'repo-empty-sandbox': [],
  'repo-dotfiles': dotfilesCommits,
};

const summary = (c: GitCommit) => ({
  hash: c.hash,
  shortHash: c.shortHash,
  subject: c.subject,
  author: c.author,
  authorEmail: c.authorEmail,
  date: c.date,
});

// ---------------------------------------------------------------------------
// Repositories
// ---------------------------------------------------------------------------

function repo(partial: Partial<Repository> & Pick<Repository, 'id' | 'name' | 'path' | 'workspacePath'>): Repository {
  const totals =
    (partial.stagedCount ?? 0) + (partial.unstagedCount ?? 0) + (partial.untrackedCount ?? 0) + (partial.conflictedCount ?? 0);
  return {
    isFavorite: false,
    currentBranch: 'main',
    isDetached: false,
    isUnborn: false,
    status: totals > 0 ? 'modified' : 'clean',
    stagedCount: 0,
    unstagedCount: 0,
    untrackedCount: 0,
    conflictedCount: 0,
    totalChanges: totals,
    lastCommit: null,
    aheadCount: 0,
    behindCount: 0,
    hasUpstream: false,
    upstreamBranch: null,
    localOnlyCommits: 0,
    stashCount: 0,
    remotes: [],
    isAccessible: true,
    errorMessage: null,
    ...partial,
  };
}

const gh = (slug: string) => [
  { name: 'origin', url: `https://github.com/${slug}.git`, direction: 'fetch' as const },
  { name: 'origin', url: `https://github.com/${slug}.git`, direction: 'push' as const },
];

export const DEMO_REPOSITORIES: Repository[] = [
  repo({
    id: 'repo-repolens',
    name: 'repolens',
    path: `${DEMO_ROOT}/repolens`,
    workspacePath: DEMO_ROOT,
    stagedCount: 2,
    unstagedCount: 2,
    untrackedCount: 1,
    lastCommit: summary(repolensCommits[0]),
    aheadCount: 1,
    hasUpstream: true,
    upstreamBranch: 'origin/main',
    stashCount: 2,
    remotes: gh('repolens/repolens'),
  }),
  repo({
    id: 'repo-design-system',
    name: 'design-system',
    path: `${DEMO_ROOT}/design-system`,
    workspacePath: DEMO_ROOT,
    currentBranch: 'feature/liquid-glass',
    stagedCount: 1,
    unstagedCount: 1,
    lastCommit: summary(designCommits[0]),
    aheadCount: 2,
    behindCount: 1,
    hasUpstream: true,
    upstreamBranch: 'origin/feature/liquid-glass',
    remotes: gh('company/design-system'),
  }),
  repo({
    id: 'repo-tailwind-preset',
    name: 'tailwind-preset',
    path: `${DEMO_ROOT}/tailwind-preset`,
    workspacePath: DEMO_ROOT,
    currentBranch: 'v4-migration',
    lastCommit: summary(tailwindCommits[0]),
    hasUpstream: true,
    upstreamBranch: 'origin/v4-migration',
    remotes: [{ name: 'origin', url: 'https://github.com/repolens/tailwind-preset.git', direction: 'fetch' }],
  }),
  repo({
    id: 'repo-kernel-driver',
    name: 'kernel-driver',
    path: `${DEMO_WORK_ROOT}/kernel-driver`,
    workspacePath: DEMO_WORK_ROOT,
    currentBranch: 'HEAD (detached at k4)',
    isDetached: true,
    unstagedCount: 1,
    conflictedCount: 1,
    lastCommit: summary(kernelCommits[1]),
    remotes: [{ name: 'upstream', url: 'git@git.example.org:drivers/kernel-driver.git', direction: 'fetch' }],
  }),
  repo({
    id: 'repo-dotfiles',
    name: 'dotfiles',
    path: `${DEMO_WORK_ROOT}/dotfiles`,
    workspacePath: DEMO_WORK_ROOT,
    untrackedCount: 1,
    lastCommit: summary(dotfilesCommits[0]),
    localOnlyCommits: 4,
    stashCount: 1,
  }),
  repo({
    id: 'repo-empty-sandbox',
    name: 'empty-sandbox',
    path: `${DEMO_ROOT}/empty-sandbox`,
    workspacePath: DEMO_ROOT,
    isUnborn: true,
  }),
  repo({
    id: 'repo-old-prototype',
    name: 'old-prototype',
    path: `${DEMO_ROOT}/old-prototype`,
    workspacePath: DEMO_ROOT,
    isAccessible: false,
    errorMessage: 'Repository folder no longer exists (moved or deleted).',
    currentBranch: '',
  }),
];

// Fix the detached label to show a real short hash.
{
  const k = DEMO_REPOSITORIES.find((r) => r.id === 'repo-kernel-driver')!;
  k.currentBranch = `HEAD (detached at ${kernelCommits[1].shortHash})`;
}

export const DEMO_DEFAULT_FAVORITES = ['repo-repolens', 'repo-design-system'];
export const DEMO_DEFAULT_TAGS: Record<string, string[]> = {
  'repo-repolens': ['work', 'rust'],
  'repo-design-system': ['work'],
  'repo-dotfiles': ['personal'],
};

// ---------------------------------------------------------------------------
// Branches, tags, stashes, worktrees
// ---------------------------------------------------------------------------

export const DEMO_BRANCHES: Record<string, GitBranch[]> = {
  'repo-repolens': [
    { name: 'main', isCurrent: true, upstream: 'origin/main', upstreamGone: false, ahead: 1, behind: 0, lastCommitDate: ago(1.5), lastCommitSubject: repolensCommits[0].subject },
    { name: 'feature/diff-viewer', isCurrent: false, upstream: 'origin/feature/diff-viewer', upstreamGone: false, ahead: 0, behind: 0, lastCommitDate: ago(5), lastCommitSubject: 'feat(diff): side-by-side mode with syntax highlighting' },
    { name: 'fix/windows-paths', isCurrent: false, upstream: 'origin/fix/windows-paths', upstreamGone: true, ahead: 0, behind: 0, lastCommitDate: ago(55), lastCommitSubject: 'fix: normalise UNC prefixes with dunce' },
    { name: 'spike/graph-layout', isCurrent: false, upstream: null, upstreamGone: false, ahead: 0, behind: 0, lastCommitDate: ago(90), lastCommitSubject: 'spike: lane assignment experiments' },
  ],
  'repo-design-system': [
    { name: 'feature/liquid-glass', isCurrent: true, upstream: 'origin/feature/liquid-glass', upstreamGone: false, ahead: 2, behind: 1, lastCommitDate: ago(5), lastCommitSubject: designCommits[0].subject },
    { name: 'main', isCurrent: false, upstream: 'origin/main', upstreamGone: false, ahead: 0, behind: 0, lastCommitDate: ago(34), lastCommitSubject: 'fix(button): pressed state contrast' },
  ],
  'repo-tailwind-preset': [
    { name: 'v4-migration', isCurrent: true, upstream: 'origin/v4-migration', upstreamGone: false, ahead: 0, behind: 0, lastCommitDate: ago(28), lastCommitSubject: tailwindCommits[0].subject },
  ],
  'repo-kernel-driver': [
    { name: 'master', isCurrent: false, upstream: null, upstreamGone: false, ahead: 0, behind: 0, lastCommitDate: ago(46), lastCommitSubject: 'wip: experiment with lock-free ring' },
  ],
  'repo-dotfiles': [
    { name: 'main', isCurrent: true, upstream: null, upstreamGone: false, ahead: 0, behind: 0, lastCommitDate: ago(18), lastCommitSubject: dotfilesCommits[0].subject },
  ],
};

export const DEMO_TAGS: Record<string, GitTag[]> = {
  'repo-repolens': [
    { name: 'v0.9.0', target: repolensCommits[7].hash, date: ago(50), subject: 'RepoLens 0.9.0' },
    { name: 'v0.1.0', target: repolensCommits[16].hash, date: ago(200), subject: 'First preview' },
  ],
  'repo-design-system': [{ name: 'v2.4.0', target: designCommits[5].hash, date: ago(90), subject: 'Release 2.4.0' }],
  'repo-kernel-driver': [{ name: 'v6.1-rc2', target: kernelCommits[2].hash, date: ago(150), subject: 'v6.1-rc2' }],
};

export const DEMO_STASHES: Record<string, GitStash[]> = {
  'repo-repolens': [
    { reference: 'stash@{0}', hash: fakeHash('repolens:stash0'), message: 'WIP on main: try alternate tray icon', date: ago(4) },
    { reference: 'stash@{1}', hash: fakeHash('repolens:stash1'), message: 'On feature/diff-viewer: word-level diff idea', date: ago(40) },
  ],
  'repo-dotfiles': [{ reference: 'stash@{0}', hash: fakeHash('dotfiles:stash0'), message: 'WIP on main: tmux theme', date: ago(70) }],
};

export const DEMO_WORKTREES: Record<string, GitWorktree[]> = {
  'repo-repolens': [
    { path: `${DEMO_ROOT}/repolens`, head: repolensCommits[0].hash, branch: 'main', isMain: true, isDetached: false, isBare: false, isLocked: false, isPrunable: false },
    { path: `${DEMO_ROOT}/repolens-diff-viewer`, head: repolensCommits[2].hash, branch: 'feature/diff-viewer', isMain: false, isDetached: false, isBare: false, isLocked: false, isPrunable: false },
    { path: '/tmp/repolens-hotfix', head: repolensCommits[7].hash, branch: null, isMain: false, isDetached: true, isBare: false, isLocked: false, isPrunable: true },
  ],
};

// ---------------------------------------------------------------------------
// Working tree changes and diffs
// ---------------------------------------------------------------------------

export const DEMO_CHANGED_FILES: Record<string, ChangedFile[]> = {
  'repo-repolens': [
    { path: 'src-tauri/src/watcher.rs', oldPath: null, stagedStatus: 'added', unstagedStatus: 'none' },
    { path: 'src/components/DiffViewer.tsx', oldPath: null, stagedStatus: 'modified', unstagedStatus: 'modified' },
    { path: 'src/App.tsx', oldPath: null, stagedStatus: 'none', unstagedStatus: 'modified' },
    { path: 'docs/screenshots/light.png', oldPath: null, stagedStatus: 'untracked', unstagedStatus: 'untracked' },
  ],
  'repo-design-system': [
    { path: 'tokens/surface.json', oldPath: 'tokens/surfaces.json', stagedStatus: 'renamed', unstagedStatus: 'none' },
    { path: 'src/Sidebar.css', oldPath: null, stagedStatus: 'none', unstagedStatus: 'modified' },
  ],
  'repo-kernel-driver': [
    { path: 'drivers/dma/ring.c', oldPath: null, stagedStatus: 'unmerged', unstagedStatus: 'unmerged' },
    { path: 'Makefile', oldPath: null, stagedStatus: 'none', unstagedStatus: 'modified' },
  ],
  'repo-dotfiles': [{ path: 'zsh/prompt local.zsh', oldPath: null, stagedStatus: 'untracked', unstagedStatus: 'untracked' }],
};

const RAW_DIFFS: Record<string, string> = {
  'repo-repolens:src-tauri/src/watcher.rs:staged': `@@ -0,0 +1,14 @@
+//! Filesystem watcher for live refresh.
+use std::time::Duration;
+
+const QUIET_PERIOD: Duration = Duration::from_millis(400);
+
+pub fn is_relevant_change(path: &str) -> bool {
+    if path.contains("/.git/objects/") {
+        return false;
+    }
+    !path.ends_with(".lock")
+}
+
+// Events are coalesced and emitted as \`repo-changed\`.
+pub struct WatchState;`,
  'repo-repolens:src/components/DiffViewer.tsx:staged': `@@ -12,6 +12,9 @@ export function DiffViewer({ diff }: Props) {
   const hasAdditions = diff.additions > 0;
   const hasDeletions = diff.deletions > 0;
-  return <div className="diff-view font-mono text-xs">{lines}</div>;
+  return (
+    <div className="font-mono text-xs overflow-x-auto">
+      <DiffHeader additions={hasAdditions} deletions={hasDeletions} />
+      <DiffTable lines={lines} />
+    </div>
+  );
 }
 
 export default DiffViewer;`,
  'repo-repolens:src/components/DiffViewer.tsx:unstaged': `@@ -14,7 +14,7 @@ export function DiffViewer({ diff }: Props) {
   return (
     <div className="font-mono text-xs overflow-x-auto">
       <DiffHeader additions={hasAdditions} deletions={hasDeletions} />
-      <DiffTable lines={lines} />
+      <DiffTable lines={lines} mode={mode} highlight />
     </div>
   );
 }`,
  'repo-repolens:src/App.tsx:unstaged': `@@ -45,5 +45,7 @@ export function App() {
   const [selectedRepoId, setSelectedRepoId] = useState<string | null>(null);
-  const [isDemo, setIsDemo] = useState(false);
+  const [view, setView] = useState<MainView>('repositories');
+  const [liveRefresh, setLiveRefresh] = useState(true);
   useEffect(() => {
     refreshRepositories();
   }, [refreshRepositories]);
@@ -120,4 +122,6 @@ export function App() {
   const counts = useMemo(() => computeCounts(repositories), [repositories]);
+  // Ignore results from stale refreshes.
+  const generation = useRef(0);
   return <Layout counts={counts} />;
 }`,
  'repo-design-system:tokens/surface.json:staged': `@@ -1,5 +1,6 @@
 {
   "surface": {
-    "sidebar": "rgba(246, 246, 248, 0.92)",
+    "sidebar": "rgba(246, 246, 248, 0.72)",
+    "sidebarOpaque": "#f6f6f8",
     "content": "#ffffff"
   }
 }`,
  'repo-design-system:src/Sidebar.css:unstaged': `@@ -3,4 +3,5 @@
 .sidebar {
-  backdrop-filter: blur(30px);
+  backdrop-filter: blur(20px) saturate(1.4);
+  border-right: 1px solid var(--separator);
 }`,
  'repo-kernel-driver:drivers/dma/ring.c:unstaged': `@@ -40,6 +40,12 @@ static void ring_advance(struct ring *r)
 {
+<<<<<<< HEAD
 	r->head = (r->head + 1) & r->mask;
+=======
+	smp_store_release(&r->head, (r->head + 1) & r->mask);
+>>>>>>> lock-free-ring
 	wake_up(&r->wait);
 }`,
  'repo-kernel-driver:Makefile:unstaged': `@@ -1,3 +1,3 @@
-CFLAGS += -O2
+CFLAGS += -O2 -Wall -Wextra
 obj-m += ring.o`,
  'repo-dotfiles:zsh/prompt local.zsh:untracked': `@@ -0,0 +1,3 @@
+# Machine-specific prompt overrides
+export PROMPT_GIT_ASYNC=1
+export PROMPT_SHOW_STASH=1`,
};

const BINARY_FILES = new Set(['repo-repolens:docs/screenshots/light.png']);

export function demoFileDiff(
  repoId: string,
  path: string,
  oldPath: string | null | undefined,
  kind: 'staged' | 'unstaged' | 'untracked',
): FileDiff {
  if (BINARY_FILES.has(`${repoId}:${path}`)) {
    return { path, oldPath: oldPath ?? null, isBinary: true, isTruncated: false, additions: 0, deletions: 0, hunks: [] };
  }
  const raw = RAW_DIFFS[`${repoId}:${path}:${kind}`] ?? '';
  return parseUnifiedDiff(path, raw, oldPath ?? null);
}

const COMMIT_DIFF_POOL: { path: string; raw: string }[] = [
  { path: 'src/components/DiffViewer.tsx', raw: RAW_DIFFS['repo-repolens:src/components/DiffViewer.tsx:staged'] },
  { path: 'src-tauri/src/watcher.rs', raw: RAW_DIFFS['repo-repolens:src-tauri/src/watcher.rs:staged'] },
  { path: 'src/App.tsx', raw: RAW_DIFFS['repo-repolens:src/App.tsx:unstaged'] },
  { path: 'tokens/surface.json', raw: RAW_DIFFS['repo-design-system:tokens/surface.json:staged'] },
  { path: 'Makefile', raw: RAW_DIFFS['repo-kernel-driver:Makefile:unstaged'] },
];

export function demoCommitDiff(hash: string): CommitDiff {
  const n = parseInt(hash.slice(0, 6), 16) || 0;
  const count = 1 + (n % 2);
  const files: FileDiff[] = [];
  for (let i = 0; i < count; i++) {
    const item = COMMIT_DIFF_POOL[(n + i * 3) % COMMIT_DIFF_POOL.length];
    files.push(parseUnifiedDiff(item.path, item.raw, null));
  }
  return { hash, files, isTruncated: false };
}

// ---------------------------------------------------------------------------
// Searchable file contents (for the cross-repo search demo)
// ---------------------------------------------------------------------------

export const DEMO_FILES: Record<string, Record<string, string>> = {
  'repo-repolens': {
    'src-tauri/src/process.rs': `//! Bounded git subprocess runner.
const MAX_CONCURRENT_GIT: usize = 6;
pub fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    // TODO: surface stderr in the UI
    run_git_raw(cwd, args, DEFAULT_TIMEOUT, OUTPUT_CAP)
}`,
    'src/App.tsx': `export const App = () => {
  // TODO: remember last selected repository
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  return <Layout settings={settings} />;
};`,
    'README.md': `# RepoLens
A read-only desktop viewer for local Git repositories.
RepoLens never fetches, pushes or modifies your repositories.`,
  },
  'repo-design-system': {
    'src/Button.tsx': `export function Button(props: ButtonProps) {
  // TODO: pressed state for high contrast mode
  return <button className={cx('btn', props.variant)} {...props} />;
}`,
    'tokens/surface.json': `{ "surface": { "sidebar": "rgba(246, 246, 248, 0.72)" } }`,
  },
  'repo-tailwind-preset': {
    'preset.css': `@theme {
  --color-accent: oklch(0.6 0.15 250);
  /* TODO: verify contrast ratios */
}`,
  },
  'repo-kernel-driver': {
    'drivers/dma/ring.c': `static void ring_advance(struct ring *r)
{
	/* TODO: lock-free variant */
	r->head = (r->head + 1) & r->mask;
}`,
  },
  'repo-dotfiles': {
    '.gitconfig': `[alias]
	lg = log --graph --oneline
	st = status -sb`,
  },
};

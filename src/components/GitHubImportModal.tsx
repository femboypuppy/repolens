import React, { useState, useMemo, useEffect } from 'react';
import {
  X,
  Search,
  Folder,
  FolderDown,
  Check,
  AlertCircle,
  Lock,
  GitFork,
  Star,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import { fetchGitHubUserRepos, type GitHubRepo } from '../services/githubService';
import { gitService, isTauri } from '../services/gitService';
import { formatRelative } from '../utils/time';

interface GitHubImportModalProps {
  isOpen: boolean;
  onClose: () => void;
  onImportSuccess: (destinationFolder: string, clonedRepoPaths: string[]) => void;
  defaultWorkspaceFolder?: string;
}

type Step = 'fetch' | 'select' | 'cloning' | 'complete';

interface CloneItemStatus {
  repo: GitHubRepo;
  status: 'pending' | 'cloning' | 'done' | 'skipped' | 'error';
  error?: string;
  targetPath?: string;
}

const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: 'bg-blue-500',
  JavaScript: 'bg-yellow-400',
  Rust: 'bg-orange-600',
  Python: 'bg-emerald-500',
  Go: 'bg-cyan-500',
  'C++': 'bg-pink-600',
  C: 'bg-neutral-500',
  HTML: 'bg-rose-500',
  CSS: 'bg-indigo-500',
  Ruby: 'bg-red-600',
  Java: 'bg-amber-600',
  Shell: 'bg-lime-500',
  Lua: 'bg-blue-400',
  HCL: 'bg-purple-500',
};

export const GitHubImportModal: React.FC<GitHubImportModalProps> = ({
  isOpen,
  onClose,
  onImportSuccess,
  defaultWorkspaceFolder,
}) => {
  const [step, setStep] = useState<Step>('fetch');
  const [username, setUsername] = useState('');
  const [token, setToken] = useState('');
  const [showTokenInput, setShowTokenInput] = useState(false);
  const [useSsh, setUseSsh] = useState(false);

  const [loadingRepos, setLoadingRepos] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [fetchedRepos, setFetchedRepos] = useState<GitHubRepo[]>([]);

  // Selection state
  const [searchFilter, setSearchFilter] = useState('');
  const [repoTypeFilter, setRepoTypeFilter] = useState<'all' | 'sources' | 'forks'>('all');
  const [selectedRepoIds, setSelectedRepoIds] = useState<Set<number>>(new Set());

  // Destination folder
  const [destinationFolder, setDestinationFolder] = useState<string>(
    defaultWorkspaceFolder || (isTauri() ? 'C:\\Projects' : '/Users/developer/Projects')
  );

  // Cloning state
  const [cloneQueue, setCloneQueue] = useState<CloneItemStatus[]>([]);
  const [currentCloningIndex, setCurrentCloningIndex] = useState(0);

  // Update default folder if prop changes
  useEffect(() => {
    if (defaultWorkspaceFolder) {
      setDestinationFolder(defaultWorkspaceFolder);
    }
  }, [defaultWorkspaceFolder]);

  // Reset when opened
  useEffect(() => {
    if (isOpen) {
      setStep('fetch');
      setFetchError(null);
      setSearchFilter('');
    }
  }, [isOpen]);

  // Handle fetching repos from GitHub
  const handleFetchRepos = async () => {
    if (!username.trim() && !token.trim()) {
      setFetchError('Please enter a GitHub username or Personal Access Token.');
      return;
    }

    setLoadingRepos(true);
    setFetchError(null);

    try {
      const repos = await fetchGitHubUserRepos(username, token);
      setFetchedRepos(repos);
      // Default: select all non-fork sources, up to 10
      const initialSelected = new Set<number>();
      for (const r of repos) {
        if (!r.isFork && initialSelected.size < 10) {
          initialSelected.add(r.id);
        }
      }
      setSelectedRepoIds(initialSelected);
      setStep('select');
    } catch (err: unknown) {
      setFetchError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoadingRepos(false);
    }
  };

  // Filter repos in selection step
  const filteredRepos = useMemo(() => {
    return fetchedRepos.filter((repo) => {
      if (repoTypeFilter === 'sources' && repo.isFork) return false;
      if (repoTypeFilter === 'forks' && !repo.isFork) return false;

      if (searchFilter.trim()) {
        const q = searchFilter.toLowerCase();
        const matchName = repo.name.toLowerCase().includes(q);
        const matchDesc = (repo.description || '').toLowerCase().includes(q);
        const matchLang = (repo.language || '').toLowerCase().includes(q);
        if (!matchName && !matchDesc && !matchLang) return false;
      }

      return true;
    });
  }, [fetchedRepos, repoTypeFilter, searchFilter]);

  // Toggle selection
  const handleToggleSelect = (id: number) => {
    setSelectedRepoIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const handleSelectAll = () => {
    if (selectedRepoIds.size === filteredRepos.length) {
      setSelectedRepoIds(new Set());
    } else {
      setSelectedRepoIds(new Set(filteredRepos.map((r) => r.id)));
    }
  };

  // Pick folder using native dialog
  const handlePickFolder = async () => {
    try {
      const picked = await gitService.pickFolder('Select Destination Directory for Repositories');
      if (picked) {
        setDestinationFolder(picked);
      }
    } catch (e) {
      console.warn('Folder pick cancelled or failed:', e);
    }
  };

  // Start batch clone process
  const handleStartClone = async () => {
    if (selectedRepoIds.size === 0) return;
    if (!destinationFolder.trim()) {
      alert('Please specify a destination directory.');
      return;
    }

    const reposToClone = fetchedRepos.filter((r) => selectedRepoIds.has(r.id));
    const initialQueue: CloneItemStatus[] = reposToClone.map((r) => ({
      repo: r,
      status: 'pending',
    }));

    setCloneQueue(initialQueue);
    setStep('cloning');
    setCurrentCloningIndex(0);

    const successfulPaths: string[] = [];

    // Clone sequentially to prevent network saturation and disk lockups
    for (let i = 0; i < initialQueue.length; i++) {
      setCurrentCloningIndex(i);
      const item = initialQueue[i];
      const cloneUrl = useSsh ? item.repo.sshUrl : item.repo.cloneUrl;

      // Update status to cloning
      setCloneQueue((prev) =>
        prev.map((q, idx) => (idx === i ? { ...q, status: 'cloning' } : q))
      );

      try {
        const clonedPath = await gitService.cloneRepository(
          cloneUrl,
          destinationFolder,
          item.repo.name
        );
        successfulPaths.push(clonedPath);
        setCloneQueue((prev) =>
          prev.map((q, idx) =>
            idx === i ? { ...q, status: 'done', targetPath: clonedPath } : q
          )
        );
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        const isAlreadyExists = errorMsg.toLowerCase().includes('already exists');
        setCloneQueue((prev) =>
          prev.map((q, idx) =>
            idx === i
              ? {
                  ...q,
                  status: isAlreadyExists ? 'skipped' : 'error',
                  error: errorMsg,
                }
              : q
          )
        );
      }
    }

    setStep('complete');
  };

  const handleFinish = () => {
    const clonedPaths = cloneQueue
      .filter((q) => q.status === 'done' && q.targetPath)
      .map((q) => q.targetPath as string);

    onImportSuccess(destinationFolder, clonedPaths);
    onClose();
  };

  const completedCount = cloneQueue.filter((q) => q.status === 'done').length;
  const skippedCount = cloneQueue.filter((q) => q.status === 'skipped').length;
  const errorCount = cloneQueue.filter((q) => q.status === 'error').length;

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-100">
      <div
        className="w-full max-w-2xl bg-white dark:bg-[#111724] border hairline rounded-xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh] transition-all"
        role="dialog"
        aria-modal="true"
        aria-labelledby="github-import-title"
      >
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b hairline bg-neutral-50/60 dark:bg-[#151c2d]/70">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-neutral-900 dark:bg-white text-white dark:text-neutral-900 flex items-center justify-center shrink-0 shadow-sm">
              {/* GitHub Octocat Mark SVG */}
              <svg className="w-5 h-5 fill-current" viewBox="0 0 24 24">
                <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0024 12c0-6.63-5.37-12-12-12z" />
              </svg>
            </div>
            <div>
              <h2 id="github-import-title" className="text-sm font-semibold text-neutral-900 dark:text-neutral-100">
                Import from GitHub
              </h2>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Clone and view all your repositories in one click
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="icon-btn"
            title="Close dialog (Escape)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="flex-1 overflow-y-auto p-6 space-y-5">
          {/* STEP 1: FETCH */}
          {step === 'fetch' && (
            <div className="space-y-4 max-w-lg mx-auto py-2">
              <div className="space-y-2">
                <label
                  htmlFor="github-username-input"
                  className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300"
                >
                  GitHub Username or Organization
                </label>
                <div className="relative">
                  <input
                    id="github-username-input"
                    type="text"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && handleFetchRepos()}
                    placeholder="e.g. torvalds or your-username"
                    className="input w-full h-9 pl-3 text-xs"
                    autoFocus
                  />
                </div>
              </div>

              {/* Personal Access Token Collapsible */}
              <div className="space-y-2 pt-1 border-t hairline">
                <button
                  type="button"
                  onClick={() => setShowTokenInput((prev) => !prev)}
                  className="flex items-center gap-1.5 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                >
                  <span>{showTokenInput ? 'Hide' : 'Add'} Personal Access Token (for private repos)</span>
                  {showTokenInput ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
                </button>

                {showTokenInput && (
                  <div className="p-3 rounded-lg bg-neutral-100/70 dark:bg-[#161d2c] border hairline space-y-2 text-xs animate-in fade-in">
                    <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
                      Using a token provides access to your private repositories and eliminates the 60 req/hour anonymous rate limit.
                    </p>
                    <input
                      type="password"
                      value={token}
                      onChange={(e) => setToken(e.target.value)}
                      placeholder="ghp_xxxxxxxxxxxxxxxxxxxx"
                      className="input w-full h-8 text-xs font-mono"
                    />
                  </div>
                )}
              </div>

              {/* Error message */}
              {fetchError && (
                <div className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/20 text-xs text-rose-700 dark:text-rose-300 flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5 text-rose-500" />
                  <span className="leading-tight">{fetchError}</span>
                </div>
              )}

              <div className="pt-2">
                <button
                  type="button"
                  onClick={handleFetchRepos}
                  disabled={loadingRepos}
                  className="btn-primary w-full h-9 justify-center text-xs font-medium"
                >
                  {loadingRepos ? (
                    <>
                      <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      <span>Fetching Repositories...</span>
                    </>
                  ) : (
                    <>
                      <FolderDown className="w-3.5 h-3.5" />
                      <span>Fetch Repositories</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* STEP 2: SELECT REPOSITORIES */}
          {step === 'select' && (
            <div className="space-y-4">
              {/* Controls bar */}
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                {/* Search filter */}
                <div className="relative flex-1 max-w-xs">
                  <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
                  <input
                    type="text"
                    value={searchFilter}
                    onChange={(e) => setSearchFilter(e.target.value)}
                    placeholder="Filter fetched repos..."
                    className="input w-full pl-8 h-8 text-xs"
                  />
                </div>

                <div className="flex items-center gap-2">
                  <div className="segmented">
                    <button
                      type="button"
                      aria-pressed={repoTypeFilter === 'all'}
                      onClick={() => setRepoTypeFilter('all')}
                    >
                      All ({fetchedRepos.length})
                    </button>
                    <button
                      type="button"
                      aria-pressed={repoTypeFilter === 'sources'}
                      onClick={() => setRepoTypeFilter('sources')}
                    >
                      Sources
                    </button>
                    <button
                      type="button"
                      aria-pressed={repoTypeFilter === 'forks'}
                      onClick={() => setRepoTypeFilter('forks')}
                    >
                      Forks
                    </button>
                  </div>

                  <button
                    type="button"
                    onClick={handleSelectAll}
                    className="btn h-8 text-xs"
                  >
                    {selectedRepoIds.size === filteredRepos.length ? 'Deselect All' : 'Select All'}
                  </button>
                </div>
              </div>

              {/* Repos list */}
              <div className="border hairline rounded-lg overflow-hidden max-h-64 overflow-y-auto divide-y hairline bg-neutral-50/40 dark:bg-[#131926]">
                {filteredRepos.length === 0 ? (
                  <div className="py-8 text-center text-xs text-neutral-400">
                    No repositories matched your filter.
                  </div>
                ) : (
                  filteredRepos.map((repo) => {
                    const isSelected = selectedRepoIds.has(repo.id);
                    return (
                      <div
                        key={repo.id}
                        onClick={() => handleToggleSelect(repo.id)}
                        className={`flex items-start gap-3 p-3 transition-colors cursor-pointer ${
                          isSelected
                            ? 'bg-blue-50/60 dark:bg-blue-900/15'
                            : 'hover:bg-neutral-100/60 dark:hover:bg-[#182133]'
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => {}} // handled by parent onClick
                          className="mt-0.5 rounded border-neutral-300 text-blue-600 focus:ring-blue-500 pointer-events-none"
                        />

                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                              {repo.name}
                            </span>

                            {repo.isPrivate && (
                              <span className="chip bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 text-[10px]">
                                <Lock className="w-2.5 h-2.5" />
                                <span>Private</span>
                              </span>
                            )}

                            {repo.isFork && (
                              <span className="chip bg-neutral-200/60 dark:bg-neutral-800 text-neutral-500 text-[10px]">
                                <GitFork className="w-2.5 h-2.5" />
                                <span>Fork</span>
                              </span>
                            )}
                          </div>

                          {repo.description && (
                            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 truncate mt-0.5">
                              {repo.description}
                            </p>
                          )}

                          <div className="flex items-center gap-3 mt-1.5 text-[10.5px] text-neutral-400">
                            {repo.language && (
                              <div className="flex items-center gap-1">
                                <span
                                  className={`w-2 h-2 rounded-full ${
                                    LANGUAGE_COLORS[repo.language] || 'bg-neutral-400'
                                  }`}
                                />
                                <span>{repo.language}</span>
                              </div>
                            )}

                            {repo.stars > 0 && (
                              <div className="flex items-center gap-0.5">
                                <Star className="w-3 h-3 text-amber-500 fill-amber-500" />
                                <span>{repo.stars}</span>
                              </div>
                            )}

                            <span>Updated {formatRelative(repo.updatedAt)}</span>
                          </div>
                        </div>
                      </div>
                    );
                  })
                )}
              </div>

              {/* Destination folder selector */}
              <div className="p-3.5 rounded-lg bg-neutral-50 dark:bg-[#141b2a] border hairline space-y-2.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-neutral-700 dark:text-neutral-300 flex items-center gap-1.5">
                    <Folder className="w-3.5 h-3.5 text-blue-500" />
                    <span>Clone destination folder:</span>
                  </label>

                  <div className="flex items-center gap-2 text-xs">
                    <label className="flex items-center gap-1 cursor-pointer text-neutral-500 dark:text-neutral-400">
                      <input
                        type="checkbox"
                        checked={useSsh}
                        onChange={(e) => setUseSsh(e.target.checked)}
                        className="rounded border-neutral-300 text-blue-600 focus:ring-blue-500"
                      />
                      <span>Clone with SSH</span>
                    </label>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={destinationFolder}
                    onChange={(e) => setDestinationFolder(e.target.value)}
                    className="input flex-1 h-8 text-xs font-mono"
                    placeholder="Destination folder path"
                  />
                  <button
                    type="button"
                    onClick={handlePickFolder}
                    className="btn h-8 text-xs shrink-0"
                  >
                    Browse...
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3 & 4: CLONING / COMPLETE */}
          {(step === 'cloning' || step === 'complete') && (
            <div className="space-y-4">
              {/* Progress status bar */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between text-xs">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-200">
                    {step === 'cloning'
                      ? `Cloning repository ${currentCloningIndex + 1} of ${cloneQueue.length}...`
                      : 'Import Complete!'}
                  </span>
                  <span className="text-neutral-500 font-mono text-[11px]">
                    {Math.round(
                      ((cloneQueue.filter((q) => q.status !== 'pending').length) /
                        (cloneQueue.length || 1)) *
                        100
                    )}
                    %
                  </span>
                </div>

                <div className="w-full bg-neutral-200 dark:bg-neutral-800 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full transition-all duration-300 rounded-full"
                    style={{
                      width: `${(cloneQueue.filter((q) => q.status !== 'pending').length / (cloneQueue.length || 1)) * 100}%`,
                    }}
                  />
                </div>
              </div>

              {/* Items status list */}
              <div className="border hairline rounded-lg overflow-hidden max-h-72 overflow-y-auto divide-y hairline bg-neutral-50/50 dark:bg-[#131926]">
                {cloneQueue.map((item) => (
                  <div
                    key={item.repo.id}
                    className="flex items-center justify-between p-2.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-medium text-neutral-900 dark:text-neutral-100 truncate">
                        {item.repo.name}
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0">
                      {item.status === 'pending' && (
                        <span className="text-neutral-400 text-[11px]">Queued</span>
                      )}
                      {item.status === 'cloning' && (
                        <span className="text-blue-500 flex items-center gap-1 text-[11px]">
                          <RefreshCw className="w-3 h-3 animate-spin" />
                          <span>Cloning...</span>
                        </span>
                      )}
                      {item.status === 'done' && (
                        <span className="text-emerald-600 dark:text-emerald-400 flex items-center gap-1 text-[11px]">
                          <Check className="w-3.5 h-3.5" />
                          <span>Cloned</span>
                        </span>
                      )}
                      {item.status === 'skipped' && (
                        <span className="text-amber-600 dark:text-amber-400 text-[11px]">
                          Already exists
                        </span>
                      )}
                      {item.status === 'error' && (
                        <span
                          className="text-rose-500 flex items-center gap-1 text-[11px]"
                          title={item.error}
                        >
                          <AlertCircle className="w-3 h-3" />
                          <span>Failed</span>
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {step === 'complete' && (
                <div className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-800 dark:text-emerald-200 flex items-center justify-between">
                  <span>
                    Cloned <strong>{completedCount}</strong> repository{completedCount === 1 ? '' : 'ies'}
                    {skippedCount > 0 ? `, ${skippedCount} already existed` : ''}
                    {errorCount > 0 ? `, ${errorCount} failed` : ''}.
                  </span>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between px-6 py-3.5 border-t hairline bg-neutral-50/70 dark:bg-[#141b2b]">
          {step === 'fetch' && (
            <div className="text-[11px] text-neutral-400">
              Repositories will be cloned using your local Git client.
            </div>
          )}

          {step === 'select' && (
            <div className="flex items-center justify-between w-full">
              <button
                type="button"
                onClick={() => setStep('fetch')}
                className="btn h-8 text-xs"
              >
                Back
              </button>

              <div className="flex items-center gap-2.5">
                <span className="text-xs text-neutral-500 dark:text-neutral-400">
                  {selectedRepoIds.size} repository{selectedRepoIds.size === 1 ? '' : 'ies'} selected
                </span>

                <button
                  type="button"
                  onClick={handleStartClone}
                  disabled={selectedRepoIds.size === 0}
                  className="btn-primary h-8 text-xs font-medium"
                >
                  <FolderDown className="w-3.5 h-3.5" />
                  <span>Clone & Import ({selectedRepoIds.size})</span>
                </button>
              </div>
            </div>
          )}

          {step === 'cloning' && (
            <div className="text-[11px] text-neutral-400">
              Please wait while repositories are being cloned...
            </div>
          )}

          {step === 'complete' && (
            <div className="flex items-center justify-end w-full">
              <button
                type="button"
                onClick={handleFinish}
                className="btn-primary h-8 px-4 text-xs font-semibold"
              >
                <span>Done — View Repositories</span>
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

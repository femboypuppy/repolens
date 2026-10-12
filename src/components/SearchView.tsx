import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Search,
  Code2,
  FolderGit2,
  AlertCircle,
  FileCode,
  ArrowRight,
} from 'lucide-react';
import type { Repository, SearchMatch } from '../types';
import { gitService } from '../services/gitService';

interface SearchViewProps {
  repositories: Repository[];
  onSelectRepo: (repo: Repository) => void;
}

interface RepoSearchResult {
  repo: Repository;
  matches: SearchMatch[];
  truncated: boolean;
  error?: string;
}

export const SearchView: React.FC<SearchViewProps> = ({
  repositories,
  onSelectRepo,
}) => {
  const [query, setQuery] = useState('');
  const [isRegex, setIsRegex] = useState(false);
  const [isCaseSensitive, setIsCaseSensitive] = useState(false);
  const [selectedRepoFilter, setSelectedRepoFilter] = useState<string>('all');
  const [results, setResults] = useState<RepoSearchResult[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [hasSearched, setHasSearched] = useState(false);
  const searchDebounceTimer = useRef<number | null>(null);

  const performSearch = useCallback(
    async (text: string) => {
      if (!text.trim()) {
        setResults([]);
        setIsSearching(false);
        setHasSearched(false);
        return;
      }

      setIsSearching(true);
      setHasSearched(true);

      const targetRepos =
        selectedRepoFilter === 'all'
          ? repositories.filter((r) => r.isAccessible && !r.isUnborn)
          : repositories.filter((r) => r.id === selectedRepoFilter && r.isAccessible && !r.isUnborn);

      const out: RepoSearchResult[] = [];

      await Promise.all(
        targetRepos.map(async (repo) => {
          try {
            const res = await gitService.searchRepository(repo.path, text, {
              regex: isRegex,
              caseSensitive: isCaseSensitive,
            });
            if (res.matches.length > 0) {
              out.push({
                repo,
                matches: res.matches,
                truncated: res.truncated,
              });
            }
          } catch (e: unknown) {
            // If regex syntax error or git error, surface friendly message
            out.push({
              repo,
              matches: [],
              truncated: false,
              error: e instanceof Error ? e.message : String(e),
            });
          }
        })
      );

      // Sort by repo name
      out.sort((a, b) => a.repo.name.localeCompare(b.repo.name));
      setResults(out);
      setIsSearching(false);
    },
    [isCaseSensitive, isRegex, repositories, selectedRepoFilter]
  );

  const handleQueryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQuery(val);
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    searchDebounceTimer.current = window.setTimeout(() => {
      performSearch(val);
    }, 280);
  };

  const handleFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (searchDebounceTimer.current) clearTimeout(searchDebounceTimer.current);
    performSearch(query);
  };

  // Re-run when toggles or filter change
  useEffect(() => {
    if (query.trim()) {
      performSearch(query);
    }
  }, [performSearch, query]);

  const totalMatches = results.reduce((sum, r) => sum + r.matches.length, 0);

  return (
    <div className="flex-1 flex flex-col min-h-0 bg-white dark:bg-neutral-900 select-none overflow-hidden">
      {/* Top Search Controls Bar */}
      <div className="px-6 py-4 border-b hairline space-y-3">
        <div>
          <h2 className="text-base font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <Search className="w-4 h-4 text-blue-500" />
            <span>Cross-Repository Search</span>
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            Search file contents across all configured Git workspaces using fast <code className="font-mono text-[11px]">git grep</code>.
          </p>
        </div>

        <form onSubmit={handleFormSubmit} className="flex flex-wrap items-center gap-2 pt-1">
          {/* Query input */}
          <div className="relative flex-1 min-w-[240px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
            <input
              type="text"
              autoFocus
              value={query}
              onChange={handleQueryChange}
              placeholder="Search code across repositories..."
              className="input w-full pl-8"
              aria-label="Code search query"
            />
          </div>

          {/* Regex Toggle */}
          <button
            type="button"
            onClick={() => setIsRegex((v) => !v)}
            className={`btn h-7 font-mono text-[11px] px-2 ${
              isRegex
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:text-white'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
            title="Use Regular Expression"
            aria-pressed={isRegex}
          >
            .*
          </button>

          {/* Case Sensitive Toggle */}
          <button
            type="button"
            onClick={() => setIsCaseSensitive((v) => !v)}
            className={`btn h-7 font-mono text-[11px] px-2 ${
              isCaseSensitive
                ? 'bg-blue-600 text-white border-blue-600 dark:bg-blue-600 dark:text-white'
                : 'text-neutral-600 dark:text-neutral-400'
            }`}
            title="Match Case"
            aria-pressed={isCaseSensitive}
          >
            Aa
          </button>

          {/* Repo Scope Selector */}
          <select
            value={selectedRepoFilter}
            onChange={(e) => setSelectedRepoFilter(e.target.value)}
            className="input h-7 text-xs bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 cursor-pointer"
            aria-label="Repository search scope"
          >
            <option value="all">All Repositories ({repositories.length})</option>
            {repositories.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>
        </form>

        {/* Status Line */}
        {hasSearched && (
          <div className="flex items-center justify-between text-[11px] text-neutral-500 pt-0.5">
            <span>
              {isSearching ? (
                'Searching repositories...'
              ) : (
                <>
                  Found <strong className="font-semibold text-neutral-700 dark:text-neutral-300">{totalMatches}</strong> match
                  {totalMatches === 1 ? '' : 'es'} in{' '}
                  <strong className="font-semibold text-neutral-700 dark:text-neutral-300">{results.length}</strong>{' '}
                  repositor{results.length === 1 ? 'y' : 'ies'}
                </>
              )}
            </span>
          </div>
        )}
      </div>

      {/* Search Results Area */}
      <div className="flex-1 overflow-y-auto px-6 py-6 space-y-6">
        {isSearching && results.length === 0 ? (
          <div className="space-y-4 max-w-3xl mx-auto py-8" aria-busy="true">
            {[40, 75, 60].map((w, i) => (
              <div key={i} className="skeleton h-14 rounded-lg" style={{ width: `${w}%` }} />
            ))}
          </div>
        ) : !hasSearched ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-400">
            <Code2 className="w-10 h-10 mb-3 opacity-50" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              Instant local code search
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              Type any query above to find code matches across your Git repositories.
            </p>
          </div>
        ) : results.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center text-neutral-400">
            <AlertCircle className="w-10 h-10 mb-3 opacity-60 text-amber-500" />
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">
              No matches found
            </p>
            <p className="text-xs text-neutral-500 mt-1 max-w-sm">
              No files matched &quot;{query}&quot; in the searched repositories.
            </p>
          </div>
        ) : (
          <div className="max-w-4xl mx-auto space-y-6">
            {results.map((res) => (
              <div
                key={res.repo.id}
                className="rounded-lg border hairline bg-white dark:bg-neutral-850/60 overflow-hidden shadow-xs"
              >
                {/* Repository Group Header */}
                <div className="flex items-center justify-between px-3.5 py-2.5 bg-neutral-50 dark:bg-neutral-800/80 border-b hairline">
                  <div className="flex items-center gap-2 min-w-0">
                    <FolderGit2 className="w-4 h-4 text-blue-500 shrink-0" />
                    <span className="font-semibold text-xs text-neutral-900 dark:text-neutral-100 truncate">
                      {res.repo.name}
                    </span>
                    <span className="font-mono text-[10.5px] text-neutral-400 truncate max-w-[200px]">
                      {res.repo.path}
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    <span className="chip bg-blue-50 dark:bg-blue-500/15 text-blue-700 dark:text-blue-300">
                      {res.matches.length} match{res.matches.length === 1 ? '' : 'es'}
                    </span>
                    <button
                      type="button"
                      onClick={() => onSelectRepo(res.repo)}
                      className="inline-flex items-center gap-1 text-[11px] font-medium text-blue-600 dark:text-blue-400 hover:underline ml-1"
                    >
                      <span>Open repo</span>
                      <ArrowRight className="w-3 h-3" />
                    </button>
                  </div>
                </div>

                {/* Match rows */}
                {res.error ? (
                  <div className="p-3 text-xs text-rose-600 dark:text-rose-400">
                    {res.error}
                  </div>
                ) : (
                  <div className="divide-y divide-neutral-100 dark:divide-neutral-800 font-mono text-[11.5px]">
                    {res.matches.map((m, idx) => (
                      <div
                        key={idx}
                        className="flex items-start gap-2.5 px-3.5 py-1.5 hover:bg-neutral-50 dark:hover:bg-neutral-800/40 transition-colors selectable"
                      >
                        <FileCode className="w-3.5 h-3.5 text-neutral-400 shrink-0 mt-0.5" />
                        <span className="text-neutral-500 dark:text-neutral-400 shrink-0 truncate max-w-[200px]">
                          {m.file}
                        </span>
                        <span className="text-neutral-400 shrink-0 select-none">
                          :{m.lineNumber}:
                        </span>
                        <span className="text-neutral-800 dark:text-neutral-200 whitespace-pre overflow-x-auto flex-1">
                          {m.line}
                        </span>
                      </div>
                    ))}
                    {res.truncated && (
                      <div className="px-3.5 py-1.5 text-[11px] text-amber-700 dark:text-amber-400 italic">
                        Results capped at 500 matches for this repository.
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

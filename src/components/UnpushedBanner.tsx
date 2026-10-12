import React, { useState } from 'react';
import { ArrowUpRight, X, AlertCircle } from 'lucide-react';
import type { Repository } from '../types';

interface UnpushedBannerProps {
  repositories: Repository[];
  onFilterUnpushed: () => void;
  isUnpushedFilterActive: boolean;
}

export const UnpushedBanner: React.FC<UnpushedBannerProps> = ({
  repositories,
  onFilterUnpushed,
  isUnpushedFilterActive,
}) => {
  const [isDismissed, setIsDismissed] = useState(false);

  // Find repos with unpushed commits
  const unpushedRepos = repositories.filter(
    (r) => r.isAccessible && (r.aheadCount > 0 || r.localOnlyCommits > 0)
  );

  if (isDismissed || isUnpushedFilterActive || unpushedRepos.length === 0) {
    return null;
  }

  const totalUnpushed = unpushedRepos.reduce(
    (sum, r) => sum + (r.aheadCount > 0 ? r.aheadCount : r.localOnlyCommits),
    0
  );

  return (
    <div className="mx-4 my-2.5 px-3 py-2 rounded-lg bg-amber-500/10 border border-amber-500/20 text-xs flex items-center justify-between gap-3 text-amber-900 dark:text-amber-200">
      <div className="flex items-center gap-2 min-w-0">
        <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
        <span className="truncate">
          <strong>Unpushed work detected:</strong> {totalUnpushed} commit{totalUnpushed === 1 ? '' : 's'} across{' '}
          {unpushedRepos.length} repositor{unpushedRepos.length === 1 ? 'y' : 'ies'}.
        </span>
      </div>

      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={onFilterUnpushed}
          className="inline-flex items-center gap-1 font-medium text-amber-800 dark:text-amber-300 hover:underline"
        >
          <span>View unpushed</span>
          <ArrowUpRight className="w-3.5 h-3.5" />
        </button>

        <button
          type="button"
          onClick={() => setIsDismissed(true)}
          className="p-1 rounded text-amber-700/60 dark:text-amber-400/60 hover:text-amber-900 dark:hover:text-amber-200 hover:bg-amber-500/10 transition-colors"
          title="Dismiss banner"
          aria-label="Dismiss banner"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
};

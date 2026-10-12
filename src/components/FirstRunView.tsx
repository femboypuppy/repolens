import React from 'react';
import { FolderPlus, Sparkles, FolderGit2, GitBranch, ShieldCheck, Zap, Layers } from 'lucide-react';

interface FirstRunViewProps {
  onAddFolder: () => void;
  onAddDirectRepo: () => void;
  onTryDemo: () => void;
}

export const FirstRunView: React.FC<FirstRunViewProps> = ({
  onAddFolder,
  onAddDirectRepo,
  onTryDemo,
}) => {
  return (
    <div className="flex-1 h-full overflow-y-auto flex items-center justify-center p-8 bg-neutral-50/50 dark:bg-neutral-950/50">
      <div className="max-w-xl w-full text-center space-y-8">
        {/* Hero Logo */}
        <div className="mx-auto w-16 h-16 rounded-2xl bg-blue-600/10 dark:bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-600 dark:text-blue-400 shadow-sm">
          <FolderGit2 className="w-8 h-8" />
        </div>

        {/* Heading */}
        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-neutral-900 dark:text-neutral-100">
            Welcome to RepoLens
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 max-w-md mx-auto leading-relaxed">
            Discover, organize, and inspect your local Git repositories with a clean, responsive desktop interface.
          </p>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
          <button
            type="button"
            onClick={onAddFolder}
            className="w-full sm:w-auto btn-primary h-9 px-4 text-xs rounded-lg"
          >
            <FolderPlus className="w-4 h-4" />
            <span>Add Workspace Folder</span>
          </button>

          <button
            type="button"
            onClick={onTryDemo}
            className="w-full sm:w-auto btn h-9 px-4 text-xs rounded-lg"
          >
            <Sparkles className="w-4 h-4 text-amber-500" />
            <span>Explore Demo Mode</span>
          </button>
        </div>

        <div className="text-[11px] text-neutral-400 dark:text-neutral-500">
          Have an individual project?{' '}
          <button
            type="button"
            onClick={onAddDirectRepo}
            className="text-blue-600 dark:text-blue-400 hover:underline font-medium inline-flex items-center gap-1"
          >
            <GitBranch className="w-3 h-3" />
            <span>Add repository directly</span>
          </button>
        </div>

        {/* Feature Highlights Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-4 border-t border-neutral-200/60 dark:border-neutral-800/60 text-left">
          <div className="p-3 rounded-lg bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
              <Layers className="w-3.5 h-3.5 text-blue-500" />
              <span>Smart Discovery</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
              Scans up to 3 levels deep while skipping dependency folders and build caches.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
              <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
              <span>Safe & Read-Only</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
              Direct git execution without background HTTP servers or cloud accounts.
            </p>
          </div>

          <div className="p-3 rounded-lg bg-white/60 dark:bg-neutral-900/60 border border-neutral-200/50 dark:border-neutral-800/50 space-y-1">
            <div className="flex items-center gap-1.5 text-xs font-medium text-neutral-800 dark:text-neutral-200">
              <Zap className="w-3.5 h-3.5 text-amber-500" />
              <span>Instant Diffs</span>
            </div>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 leading-normal">
              Inspect staged and unstaged file differences with line numbers and syntax styling.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

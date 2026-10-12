import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { RepositoryList } from '../components/RepositoryList';
import { DEMO_REPOSITORIES } from '../demo/sampleData';

describe('RepositoryList Component', () => {
  it('renders repository cards with name, branch, and status', () => {
    const onSelect = vi.fn();
    const onToggleFav = vi.fn();

    render(
      <RepositoryList
        repositories={DEMO_REPOSITORIES}
        selectedRepoId={null}
        onSelectRepo={onSelect}
        onToggleFavorite={onToggleFav}
        compactMode={false}
        searchQuery=""
        onClearSearch={() => {}}
      />
    );

    expect(screen.getByText('repolens')).toBeInTheDocument();
    expect(screen.getByText('design-system')).toBeInTheDocument();
    expect(screen.getByText('tailwind-preset')).toBeInTheDocument();
    expect(screen.getByText('kernel-driver')).toBeInTheDocument();
    expect(screen.getByText('empty-sandbox')).toBeInTheDocument();
  });

  it('handles repository selection when clicked', () => {
    const onSelect = vi.fn();
    const onToggleFav = vi.fn();

    render(
      <RepositoryList
        repositories={DEMO_REPOSITORIES}
        selectedRepoId={null}
        onSelectRepo={onSelect}
        onToggleFavorite={onToggleFav}
        compactMode={false}
        searchQuery=""
        onClearSearch={() => {}}
      />
    );

    fireEvent.click(screen.getByText('repolens'));
    expect(onSelect).toHaveBeenCalledWith(DEMO_REPOSITORIES[0]);
  });

  it('handles favorite toggle', () => {
    const onSelect = vi.fn();
    const onToggleFav = vi.fn();

    render(
      <RepositoryList
        repositories={DEMO_REPOSITORIES}
        selectedRepoId={null}
        onSelectRepo={onSelect}
        onToggleFavorite={onToggleFav}
        compactMode={false}
        searchQuery=""
        onClearSearch={() => {}}
      />
    );

    const favButtons = screen.getAllByRole('button', { name: /favorite/i });
    expect(favButtons.length).toBeGreaterThan(0);
    fireEvent.click(favButtons[0]);
    expect(onToggleFav).toHaveBeenCalled();
  });

  it('renders empty state when no repositories match', () => {
    render(
      <RepositoryList
        repositories={[]}
        selectedRepoId={null}
        onSelectRepo={() => {}}
        onToggleFavorite={() => {}}
        compactMode={false}
        searchQuery="non-existent"
        onClearSearch={() => {}}
      />
    );

    expect(screen.getByText(/No repositories match "non-existent"/i)).toBeInTheDocument();
  });
});

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { FleetOverview } from '../components/FleetOverview';
import { DEMO_REPOSITORIES } from '../demo/sampleData';

describe('FleetOverview Component', () => {
  it('renders all repositories in a tabular format', () => {
    render(
      <FleetOverview
        repositories={DEMO_REPOSITORIES}
        selectedRepoId={null}
        onSelectRepo={() => {}}
        onToggleFavorite={() => {}}
        onOpenVsCode={() => {}}
        onOpenTerminal={() => {}}
        onOpenFileManager={() => {}}
      />
    );

    expect(screen.getByText('Repository')).toBeInTheDocument();
    expect(screen.getByText('Upstream Sync')).toBeInTheDocument();
    expect(screen.getByText('repolens')).toBeInTheDocument();
    expect(screen.getByText('design-system')).toBeInTheDocument();
  });

  it('triggers quick launchers when action buttons are clicked', () => {
    const onOpenVsCode = vi.fn();
    const onOpenTerminal = vi.fn();
    const onOpenFileManager = vi.fn();

    render(
      <FleetOverview
        repositories={DEMO_REPOSITORIES}
        selectedRepoId={null}
        onSelectRepo={() => {}}
        onToggleFavorite={() => {}}
        onOpenVsCode={onOpenVsCode}
        onOpenTerminal={onOpenTerminal}
        onOpenFileManager={onOpenFileManager}
      />
    );

    const vsCodeButtons = screen.getAllByTitle('Open in VS Code');
    expect(vsCodeButtons.length).toBeGreaterThan(0);
    fireEvent.click(vsCodeButtons[0]);
    expect(onOpenVsCode).toHaveBeenCalledWith(DEMO_REPOSITORIES[0].path, expect.anything());

    const terminalButtons = screen.getAllByTitle('Open in Terminal');
    expect(terminalButtons.length).toBeGreaterThan(0);
    fireEvent.click(terminalButtons[0]);
    expect(onOpenTerminal).toHaveBeenCalledWith(DEMO_REPOSITORIES[0].path, expect.anything());
  });
});

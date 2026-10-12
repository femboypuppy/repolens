import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CommandPalette } from '../components/CommandPalette';
import { DEMO_REPOSITORIES } from '../demo/sampleData';

describe('CommandPalette Component', () => {
  it('renders commands and repositories when open', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={() => {}}
        repositories={DEMO_REPOSITORIES}
        selectedRepo={DEMO_REPOSITORIES[0]}
        onSelectRepo={() => {}}
        onAddFolder={() => {}}
        onAddDirectRepo={() => {}}
        onRefresh={() => {}}
        onOpenSettings={() => {}}
        onOpenVsCode={() => {}}
        onOpenTerminal={() => {}}
        onOpenFileManager={() => {}}
        onToggleTheme={() => {}}
        onToggleDemo={() => {}}
        isFleetView={false}
        onToggleFleetView={() => {}}
      />
    );

    expect(screen.getByPlaceholderText(/Type a command or search/i)).toBeInTheDocument();
    expect(screen.getByText('repolens')).toBeInTheDocument();
    expect(screen.getByText('Add Workspace Folder...')).toBeInTheDocument();
  });

  it('filters commands when query is typed', () => {
    render(
      <CommandPalette
        isOpen={true}
        onClose={() => {}}
        repositories={DEMO_REPOSITORIES}
        selectedRepo={DEMO_REPOSITORIES[0]}
        onSelectRepo={() => {}}
        onAddFolder={() => {}}
        onAddDirectRepo={() => {}}
        onRefresh={() => {}}
        onOpenSettings={() => {}}
        onOpenVsCode={() => {}}
        onOpenTerminal={() => {}}
        onOpenFileManager={() => {}}
        onToggleTheme={() => {}}
        onToggleDemo={() => {}}
        isFleetView={false}
        onToggleFleetView={() => {}}
      />
    );

    const input = screen.getByPlaceholderText(/Type a command or search/i);
    fireEvent.change(input, { target: { value: 'VS Code' } });

    expect(screen.getByText(/Open "repolens" in VS Code/i)).toBeInTheDocument();
    expect(screen.queryByText('Add Workspace Folder...')).not.toBeInTheDocument();
  });

  it('executes command on click', () => {
    const onAddFolder = vi.fn();
    const onClose = vi.fn();

    render(
      <CommandPalette
        isOpen={true}
        onClose={onClose}
        repositories={DEMO_REPOSITORIES}
        selectedRepo={null}
        onSelectRepo={() => {}}
        onAddFolder={onAddFolder}
        onAddDirectRepo={() => {}}
        onRefresh={() => {}}
        onOpenSettings={() => {}}
        onOpenVsCode={() => {}}
        onOpenTerminal={() => {}}
        onOpenFileManager={() => {}}
        onToggleTheme={() => {}}
        onToggleDemo={() => {}}
        isFleetView={false}
        onToggleFleetView={() => {}}
      />
    );

    fireEvent.click(screen.getByText('Add Workspace Folder...'));
    expect(onAddFolder).toHaveBeenCalled();
    expect(onClose).toHaveBeenCalled();
  });
});

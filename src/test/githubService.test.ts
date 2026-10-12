import { describe, it, expect, vi } from 'vitest';
import { fetchGitHubUserRepos } from '../services/githubService';

describe('githubService', () => {
  it('returns demo repositories when in demo mode', async () => {
    const repos = await fetchGitHubUserRepos('femboypuppy');
    expect(repos.length).toBeGreaterThan(0);
    const repolens = repos.find((r) => r.name === 'repolens');
    expect(repolens).toBeDefined();
    expect(repolens?.fullName).toBe('femboypuppy/repolens');
    expect(repolens?.language).toBe('TypeScript');
  });

  it('rejects with descriptive error when username and token are empty', async () => {
    // Force non-demo mode for test
    vi.mock('../services/gitService', () => ({
      isDemo: () => false,
    }));

    await expect(fetchGitHubUserRepos('')).rejects.toThrow();
  });
});

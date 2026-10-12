import { describe, it, expect, vi, beforeEach } from 'vitest';
import { fetchGitHubUserRepos } from '../services/githubService';

vi.mock('../services/gitService', () => ({
  isDemo: vi.fn().mockReturnValue(false),
}));

describe('githubService', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('parses GitHub API response correctly', async () => {
    const mockRepos = [
      {
        id: 1,
        name: 'test-repo',
        full_name: 'user/test-repo',
        description: 'Test description',
        html_url: 'https://github.com/user/test-repo',
        clone_url: 'https://github.com/user/test-repo.git',
        ssh_url: 'git@github.com:user/test-repo.git',
        stargazers_count: 42,
        forks_count: 5,
        language: 'TypeScript',
        private: false,
        fork: false,
        updated_at: '2026-10-12T10:00:00Z',
        default_branch: 'main',
        size: 1024,
      },
    ];

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: true,
        status: 200,
        json: async () => mockRepos,
      })
    );

    const repos = await fetchGitHubUserRepos('user');
    expect(repos).toHaveLength(1);
    expect(repos[0].name).toBe('test-repo');
    expect(repos[0].stars).toBe(42);
    expect(repos[0].language).toBe('TypeScript');
  });

  it('rejects with descriptive error when username and token are empty', async () => {
    await expect(fetchGitHubUserRepos('')).rejects.toThrow('Please enter a GitHub username');
  });

  it('handles 404 user not found error', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 404,
        statusText: 'Not Found',
      })
    );

    await expect(fetchGitHubUserRepos('nonexistent-user-123')).rejects.toThrow('not found');
  });

  it('handles 403 rate limit error with helpful guidance', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        text: async () => 'API rate limit exceeded for IP',
      })
    );

    await expect(fetchGitHubUserRepos('busy-user')).rejects.toThrow('rate limit');
  });
});

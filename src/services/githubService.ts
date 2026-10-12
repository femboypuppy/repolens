import { isDemo } from './gitService';

export interface GitHubRepo {
  id: number;
  name: string;
  fullName: string;
  description: string | null;
  htmlUrl: string;
  cloneUrl: string;
  sshUrl: string;
  stars: number;
  forks: number;
  language: string | null;
  isPrivate: boolean;
  isFork: boolean;
  updatedAt: string;
  defaultBranch: string;
  sizeKb: number;
}

const DEMO_GITHUB_REPOS: GitHubRepo[] = [
  {
    id: 101,
    name: 'repolens',
    fullName: 'femboypuppy/repolens',
    description: 'Polished desktop Git client built with Tauri v2, React 19, and Rust.',
    htmlUrl: 'https://github.com/femboypuppy/repolens',
    cloneUrl: 'https://github.com/femboypuppy/repolens.git',
    sshUrl: 'git@github.com:femboypuppy/repolens.git',
    stars: 142,
    forks: 18,
    language: 'TypeScript',
    isPrivate: false,
    isFork: false,
    updatedAt: new Date(Date.now() - 3600 * 1000 * 2).toISOString(),
    defaultBranch: 'main',
    sizeKb: 4820,
  },
  {
    id: 102,
    name: 'tessera',
    fullName: 'femboypuppy/tessera',
    description: 'Fast, lightweight modular canvas renderer for high-density spatial graphs.',
    htmlUrl: 'https://github.com/femboypuppy/tessera',
    cloneUrl: 'https://github.com/femboypuppy/tessera.git',
    sshUrl: 'git@github.com:femboypuppy/tessera.git',
    stars: 89,
    forks: 7,
    language: 'Rust',
    isPrivate: false,
    isFork: false,
    updatedAt: new Date(Date.now() - 3600 * 1000 * 18).toISOString(),
    defaultBranch: 'main',
    sizeKb: 2150,
  },
  {
    id: 103,
    name: 'hyperion-engine',
    fullName: 'femboypuppy/hyperion-engine',
    description: 'Low-latency async streaming audio synthesis pipeline with DSP filters.',
    htmlUrl: 'https://github.com/femboypuppy/hyperion-engine',
    cloneUrl: 'https://github.com/femboypuppy/hyperion-engine.git',
    sshUrl: 'git@github.com:femboypuppy/hyperion-engine.git',
    stars: 54,
    forks: 4,
    language: 'C++',
    isPrivate: false,
    isFork: false,
    updatedAt: new Date(Date.now() - 3600 * 1000 * 48).toISOString(),
    defaultBranch: 'master',
    sizeKb: 8910,
  },
  {
    id: 104,
    name: 'dotfiles',
    fullName: 'femboypuppy/dotfiles',
    description: 'Personal configuration files, shell scripts, and Neovim Lua setup.',
    htmlUrl: 'https://github.com/femboypuppy/dotfiles',
    cloneUrl: 'https://github.com/femboypuppy/dotfiles.git',
    sshUrl: 'git@github.com:femboypuppy/dotfiles.git',
    stars: 23,
    forks: 2,
    language: 'Lua',
    isPrivate: false,
    isFork: false,
    updatedAt: new Date(Date.now() - 3600 * 1000 * 96).toISOString(),
    defaultBranch: 'main',
    sizeKb: 640,
  },
  {
    id: 105,
    name: 'private-infra-secrets',
    fullName: 'femboypuppy/private-infra-secrets',
    description: 'Terraform and Ansible configs for internal cluster deployment.',
    htmlUrl: 'https://github.com/femboypuppy/private-infra-secrets',
    cloneUrl: 'https://github.com/femboypuppy/private-infra-secrets.git',
    sshUrl: 'git@github.com:femboypuppy/private-infra-secrets.git',
    stars: 0,
    forks: 0,
    language: 'HCL',
    isPrivate: true,
    isFork: false,
    updatedAt: new Date(Date.now() - 3600 * 1000 * 120).toISOString(),
    defaultBranch: 'main',
    sizeKb: 1200,
  },
];

interface RawGitHubRepo {
  id: number;
  name: string;
  full_name: string;
  description: string | null;
  html_url: string;
  clone_url: string;
  ssh_url: string;
  stargazers_count: number;
  forks_count: number;
  language: string | null;
  private: boolean;
  fork: boolean;
  updated_at: string;
  default_branch: string;
  size: number;
}

export async function fetchGitHubUserRepos(
  username: string,
  token?: string
): Promise<GitHubRepo[]> {
  if (isDemo()) {
    await new Promise((r) => setTimeout(r, 450));
    return DEMO_GITHUB_REPOS;
  }

  const cleanUser = username.trim();
  const cleanToken = token?.trim();

  if (!cleanUser && !cleanToken) {
    throw new Error('Please enter a GitHub username or Personal Access Token.');
  }

  const headers: Record<string, string> = {
    Accept: 'application/vnd.github.v3+json',
  };
  if (cleanToken) {
    headers.Authorization = `Bearer ${cleanToken}`;
  }

  const endpoint = cleanToken && !cleanUser
    ? 'https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner,collaborator'
    : `https://api.github.com/users/${encodeURIComponent(cleanUser)}/repos?per_page=100&sort=updated`;

  try {
    const res = await fetch(endpoint, { headers });

    if (!res.ok) {
      if (res.status === 404) {
        throw new Error(`GitHub user or organization "${cleanUser}" was not found.`);
      }
      if (res.status === 401) {
        throw new Error('Invalid GitHub Personal Access Token.');
      }
      if (res.status === 403) {
        const errorText = await res.text().catch(() => '');
        if (errorText.toLowerCase().includes('rate limit')) {
          throw new Error('GitHub API rate limit reached. Add a Personal Access Token below to increase limit.');
        }
        throw new Error(`GitHub request forbidden (${res.status}): ${res.statusText}`);
      }
      throw new Error(`GitHub request failed: ${res.status} ${res.statusText}`);
    }

    const data = (await res.json()) as RawGitHubRepo[];
    if (!Array.isArray(data)) {
      throw new Error('Unexpected data format returned from GitHub API.');
    }

    return data.map((r) => ({
      id: r.id,
      name: r.name,
      fullName: r.full_name,
      description: r.description,
      htmlUrl: r.html_url,
      cloneUrl: r.clone_url,
      sshUrl: r.ssh_url,
      stars: r.stargazers_count ?? 0,
      forks: r.forks_count ?? 0,
      language: r.language,
      isPrivate: Boolean(r.private),
      isFork: Boolean(r.fork),
      updatedAt: r.updated_at,
      defaultBranch: r.default_branch || 'main',
      sizeKb: r.size ?? 0,
    }));
  } catch (err: unknown) {
    // If running in browser preview or network failed, fallback to demo if applicable
    if (isDemo()) {
      return DEMO_GITHUB_REPOS;
    }
    throw err;
  }
}

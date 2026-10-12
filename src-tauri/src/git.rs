//! Read-only Git operations and output parsers.
//!
//! All commands use machine-readable formats (porcelain v2, `-z`, NUL/unit
//! separators) where available. Nothing here writes to a repository.

use std::path::Path;
use std::time::Duration;

use crate::models::{
    BlameLine, BranchComparison, ChangedFile, ChangedFileSummary, ChangedFiles, CommitDiff,
    CommitSummary, DiffHunk, DiffLine, FileDiff, GitBranch, GitCommit, GitEnvironment,
    GitRemote, GitStash, GitTag, GitWorktree, RepositoryInfo, SearchMatch, SearchResult,
};
use crate::process::{hide_console, run_git, run_git_raw, DEFAULT_OUTPUT_CAP, DEFAULT_TIMEOUT};

pub const MAX_DIFF_LINES: usize = 5_000;
pub const MAX_DIFF_BYTES: usize = 4 * 1024 * 1024;
pub const MAX_CHANGED_FILES: usize = 5_000;
pub const MAX_UNTRACKED_FILE_BYTES: u64 = 1024 * 1024;
const MAX_SEARCH_MATCHES: usize = 500;
const MAX_SEARCH_LINE_CHARS: usize = 400;

// ---------------------------------------------------------------------------
// Environment
// ---------------------------------------------------------------------------

pub fn get_git_environment() -> GitEnvironment {
    let mut cmd = std::process::Command::new("git");
    cmd.arg("--version");
    hide_console(&mut cmd);
    match cmd.output() {
        Ok(out) if out.status.success() => {
            let version = String::from_utf8_lossy(&out.stdout).trim().to_string();
            let user_email = {
                let mut c = std::process::Command::new("git");
                c.args(["config", "--global", "user.email"]);
                hide_console(&mut c);
                c.output()
                    .ok()
                    .filter(|o| o.status.success())
                    .map(|o| String::from_utf8_lossy(&o.stdout).trim().to_string())
                    .filter(|s| !s.is_empty())
            };
            GitEnvironment {
                installed: true,
                version,
                executable_path: which_git().unwrap_or_else(|| "git".to_string()),
                user_email,
            }
        }
        _ => GitEnvironment {
            installed: false,
            version: String::new(),
            executable_path: String::new(),
            user_email: None,
        },
    }
}

fn which_git() -> Option<String> {
    let path = std::env::var_os("PATH")?;
    let names: &[&str] = if cfg!(windows) { &["git.exe", "git.cmd"] } else { &["git"] };
    for dir in std::env::split_paths(&path) {
        for name in names {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(candidate.to_string_lossy().into_owned());
            }
        }
    }
    None
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/// Undo Git's C-style path quoting (`"a\tb\303\251"`). Returns input unchanged if unquoted.
pub fn unquote_git_path(s: &str) -> String {
    let bytes = s.as_bytes();
    if bytes.len() < 2 || bytes[0] != b'"' || bytes[bytes.len() - 1] != b'"' {
        return s.to_string();
    }
    let inner = &bytes[1..bytes.len() - 1];
    let mut out: Vec<u8> = Vec::with_capacity(inner.len());
    let mut i = 0;
    while i < inner.len() {
        let b = inner[i];
        if b == b'\\' && i + 1 < inner.len() {
            let n = inner[i + 1];
            match n {
                b'n' => { out.push(b'\n'); i += 2; }
                b't' => { out.push(b'\t'); i += 2; }
                b'r' => { out.push(b'\r'); i += 2; }
                b'a' => { out.push(7); i += 2; }
                b'b' => { out.push(8); i += 2; }
                b'f' => { out.push(12); i += 2; }
                b'v' => { out.push(11); i += 2; }
                b'"' => { out.push(b'"'); i += 2; }
                b'\\' => { out.push(b'\\'); i += 2; }
                b'0'..=b'7' => {
                    let oct = inner.get(i + 1..i + 4).unwrap_or(&[]);
                    if oct.len() == 3 && oct.iter().all(|c| (b'0'..=b'7').contains(c)) {
                        let v = (oct[0] - b'0') as u32 * 64 + (oct[1] - b'0') as u32 * 8 + (oct[2] - b'0') as u32;
                        out.push(v as u8);
                        i += 4;
                    } else {
                        out.push(b);
                        i += 1;
                    }
                }
                _ => { out.push(b); i += 1; }
            }
        } else {
            out.push(b);
            i += 1;
        }
    }
    String::from_utf8_lossy(&out).into_owned()
}

/// Strip credentials from remote URLs such as `https://user:token@host/repo`.
pub fn redact_url(url: &str) -> String {
    if let Some(scheme_end) = url.find("://") {
        let rest = &url[scheme_end + 3..];
        let authority_end = rest.find('/').unwrap_or(rest.len());
        if let Some(at) = rest[..authority_end].rfind('@') {
            return format!("{}://***@{}", &url[..scheme_end], &rest[at + 1..]);
        }
    }
    url.to_string()
}

fn status_char(c: char) -> &'static str {
    match c {
        'M' => "modified",
        'A' => "added",
        'D' => "deleted",
        'R' => "renamed",
        'C' => "copied",
        'T' => "typechange",
        'U' => "unmerged",
        _ => "none",
    }
}

fn is_hex_rev(s: &str) -> bool {
    (4..=64).contains(&s.len()) && s.chars().all(|c| c.is_ascii_hexdigit())
}

// ---------------------------------------------------------------------------
// Status (porcelain v2)
// ---------------------------------------------------------------------------

#[derive(Debug, Default, Clone, PartialEq, Eq)]
pub struct StatusSummary {
    pub oid: Option<String>,
    pub head: Option<String>,
    pub upstream: Option<String>,
    pub ahead: usize,
    pub behind: usize,
    pub files: Vec<ChangedFile>,
    pub staged: usize,
    pub unstaged: usize,
    pub untracked: usize,
    pub conflicted: usize,
    pub truncated: bool,
}

/// Parse `git status --porcelain=v2 --branch -z` output.
pub fn parse_status_v2(data: &str) -> StatusSummary {
    let mut s = StatusSummary::default();
    let records: Vec<&str> = data.split('\0').collect();
    let mut i = 0;
    while i < records.len() {
        let rec = records[i];
        i += 1;
        if rec.is_empty() {
            continue;
        }
        if let Some(header) = rec.strip_prefix("# ") {
            if let Some(v) = header.strip_prefix("branch.oid ") {
                if v != "(initial)" {
                    s.oid = Some(v.to_string());
                }
            } else if let Some(v) = header.strip_prefix("branch.head ") {
                if v != "(detached)" {
                    s.head = Some(v.to_string());
                }
            } else if let Some(v) = header.strip_prefix("branch.upstream ") {
                s.upstream = Some(v.to_string());
            } else if let Some(v) = header.strip_prefix("branch.ab ") {
                for part in v.split_whitespace() {
                    if let Some(n) = part.strip_prefix('+') {
                        s.ahead = n.parse().unwrap_or(0);
                    } else if let Some(n) = part.strip_prefix('-') {
                        s.behind = n.parse().unwrap_or(0);
                    }
                }
            }
            continue;
        }

        let kind = rec.as_bytes()[0];
        let push = |s: &mut StatusSummary, f: ChangedFile| {
            if s.files.len() < MAX_CHANGED_FILES {
                s.files.push(f);
            } else {
                s.truncated = true;
            }
        };
        match kind {
            b'1' | b'2' | b'u' => {
                let field_count = match kind { b'1' => 9, b'2' => 10, _ => 11 };
                let parts: Vec<&str> = rec.splitn(field_count, ' ').collect();
                if parts.len() < field_count {
                    continue;
                }
                let xy: Vec<char> = parts[1].chars().collect();
                let (x, y) = (xy.first().copied().unwrap_or('.'), xy.get(1).copied().unwrap_or('.'));
                let path = parts[field_count - 1].to_string();
                let old_path = if kind == b'2' {
                    let orig = records.get(i).map(|p| p.to_string());
                    i += 1;
                    orig
                } else {
                    None
                };
                if kind == b'u' {
                    s.conflicted += 1;
                    push(&mut s, ChangedFile {
                        path,
                        old_path: None,
                        staged_status: "unmerged".into(),
                        unstaged_status: "unmerged".into(),
                    });
                } else {
                    if x != '.' { s.staged += 1; }
                    if y != '.' { s.unstaged += 1; }
                    push(&mut s, ChangedFile {
                        path,
                        old_path,
                        staged_status: status_char(x).into(),
                        unstaged_status: status_char(y).into(),
                    });
                }
            }
            b'?' => {
                s.untracked += 1;
                push(&mut s, ChangedFile {
                    path: rec[2.min(rec.len())..].to_string(),
                    old_path: None,
                    staged_status: "none".into(),
                    unstaged_status: "untracked".into(),
                });
            }
            _ => {}
        }
    }
    s
}

pub fn get_status(repo: &Path) -> Result<StatusSummary, String> {
    let out = run_git(
        repo,
        &["status", "--porcelain=v2", "--branch", "-z", "--untracked-files=all", "--ignore-submodules=dirty"],
    )?;
    Ok(parse_status_v2(&out))
}

pub fn list_changed_files(repo: &Path) -> Result<ChangedFiles, String> {
    let s = get_status(repo)?;
    Ok(ChangedFiles { files: s.files, truncated: s.truncated })
}

// ---------------------------------------------------------------------------
// Repository overview
// ---------------------------------------------------------------------------

pub fn parse_remotes(raw: &str) -> Vec<GitRemote> {
    raw.lines()
        .filter_map(|line| {
            let mut parts = line.split_whitespace();
            let name = parts.next()?;
            let url = parts.next()?;
            let dir = parts.next().unwrap_or("(fetch)");
            Some(GitRemote {
                name: name.to_string(),
                url: redact_url(url),
                direction: if dir.contains("push") { "push" } else { "fetch" }.to_string(),
            })
        })
        .collect()
}

pub fn inspect_repository(repo: &Path, workspace_path: &str, is_favorite: bool) -> Result<RepositoryInfo, String> {
    if !repo.exists() {
        return Err(format!("Repository no longer exists at {}", repo.display()));
    }
    let name = repo
        .file_name()
        .map(|n| n.to_string_lossy().into_owned())
        .unwrap_or_else(|| repo.to_string_lossy().into_owned());
    let path = repo.to_string_lossy().into_owned();

    let status = get_status(repo)?;
    let is_unborn = status.oid.is_none();
    let is_detached = status.head.is_none() && !is_unborn;
    let current_branch = match (&status.head, &status.oid) {
        (Some(h), _) => h.clone(),
        (None, Some(oid)) => format!("detached at {}", &oid[..oid.len().min(7)]),
        (None, None) => "unknown".to_string(),
    };

    let last_commit = if is_unborn {
        None
    } else {
        run_git(repo, &["log", "-1", "--format=%H%x00%h%x00%an%x00%ae%x00%aI%x00%s"])
            .ok()
            .and_then(|out| {
                let f: Vec<&str> = out.trim_end_matches('\n').split('\0').collect();
                (f.len() >= 6).then(|| CommitSummary {
                    hash: f[0].into(),
                    short_hash: f[1].into(),
                    author: f[2].into(),
                    author_email: f[3].into(),
                    date: f[4].into(),
                    subject: f[5].into(),
                })
            })
    };

    let local_only_commits = if status.upstream.is_none() && !is_unborn {
        run_git(repo, &["rev-list", "--count", "HEAD", "--not", "--remotes"])
            .ok()
            .and_then(|s| s.trim().parse().ok())
            .unwrap_or(0)
    } else {
        0
    };

    let stash_count = run_git(repo, &["rev-list", "--walk-reflogs", "--count", "refs/stash"])
        .ok()
        .and_then(|s| s.trim().parse().ok())
        .unwrap_or(0);

    let remotes = run_git(repo, &["remote", "-v"]).map(|r| parse_remotes(&r)).unwrap_or_default();

    let total = status.staged + status.unstaged + status.untracked + status.conflicted;
    Ok(RepositoryInfo {
        id: path.clone(),
        name,
        path,
        workspace_path: workspace_path.to_string(),
        is_favorite,
        current_branch,
        is_detached,
        is_unborn,
        status: if total == 0 { "clean" } else { "modified" }.to_string(),
        staged_count: status.staged,
        unstaged_count: status.unstaged,
        untracked_count: status.untracked,
        conflicted_count: status.conflicted,
        total_changes: total,
        last_commit,
        ahead_count: status.ahead,
        behind_count: status.behind,
        has_upstream: status.upstream.is_some(),
        upstream_branch: status.upstream,
        local_only_commits,
        stash_count,
        remotes,
        is_accessible: true,
        error_message: None,
    })
}

// ---------------------------------------------------------------------------
// Commits / graph
// ---------------------------------------------------------------------------

const LOG_FORMAT: &str = "--format=%H%x1f%P%x1f%h%x1f%an%x1f%ae%x1f%aI%x1f%D%x1f%s%x1f%b";

/// Parse `git log -z` output produced with [`LOG_FORMAT`].
pub fn parse_log(out: &str) -> Vec<GitCommit> {
    out.split('\0')
        .filter_map(|rec| {
            let rec = rec.trim_start_matches('\n');
            if rec.is_empty() {
                return None;
            }
            let f: Vec<&str> = rec.splitn(9, '\x1f').collect();
            if f.len() < 9 {
                return None;
            }
            Some(GitCommit {
                hash: f[0].into(),
                parents: f[1].split_whitespace().map(String::from).collect(),
                short_hash: f[2].into(),
                author: f[3].into(),
                author_email: f[4].into(),
                date: f[5].into(),
                refs: f[6].split(", ").filter(|s| !s.is_empty()).map(String::from).collect(),
                subject: f[7].into(),
                body: f[8].trim().into(),
            })
        })
        .collect()
}

pub fn get_commits(repo: &Path, limit: usize, skip: usize, all_refs: bool) -> Result<Vec<GitCommit>, String> {
    let limit = limit.clamp(1, 1000).to_string();
    let skip = skip.min(1_000_000).to_string();
    let mut args = vec!["log", "-z", "--topo-order", LOG_FORMAT, "-n", &limit, "--skip", &skip];
    if all_refs {
        args.extend(["--exclude=refs/stash", "--all"]);
    }
    match run_git_raw(repo, &args, DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP) {
        Ok(out) if out.code == Some(0) => Ok(parse_log(&out.stdout_lossy())),
        // Unborn branch: no commits yet.
        Ok(out) if out.stderr.contains("does not have any commits") => Ok(Vec::new()),
        Ok(out) => Err(out.stderr),
        Err(e) => Err(e),
    }
}

/// Commits authored by the repository's configured `user.email` within the last `days`.
pub fn get_my_commits(repo: &Path, days: u32) -> Result<Vec<GitCommit>, String> {
    let email = run_git(repo, &["config", "user.email"]).unwrap_or_default();
    let email = email.trim();
    if email.is_empty() {
        return Ok(Vec::new());
    }
    let since = format!("--since={}.days.ago", days.clamp(1, 365));
    let author = format!("--author={}", email);
    let args = [
        "log", "-z", LOG_FORMAT, "--branches", "-F", "--regexp-ignore-case",
        author.as_str(), since.as_str(), "-n", "500",
    ];
    match run_git_raw(repo, &args, DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP) {
        Ok(out) if out.code == Some(0) => Ok(parse_log(&out.stdout_lossy())),
        Ok(_) => Ok(Vec::new()),
        Err(e) => Err(e),
    }
}

// ---------------------------------------------------------------------------
// Refs: branches, tags, stashes, worktrees
// ---------------------------------------------------------------------------

pub fn parse_branches(out: &str) -> Vec<GitBranch> {
    out.lines()
        .filter_map(|line| {
            let f: Vec<&str> = line.split('\0').collect();
            if f.len() < 6 || f[0].is_empty() {
                return None;
            }
            let track = f[3].trim();
            let mut ahead = 0;
            let mut behind = 0;
            for part in track.split(',') {
                let p = part.trim();
                if let Some(n) = p.strip_prefix("ahead ") {
                    ahead = n.parse().unwrap_or(0);
                } else if let Some(n) = p.strip_prefix("behind ") {
                    behind = n.parse().unwrap_or(0);
                }
            }
            Some(GitBranch {
                name: f[0].into(),
                is_current: f[1].trim() == "*",
                upstream: Some(f[2].trim()).filter(|s| !s.is_empty()).map(String::from),
                upstream_gone: track == "gone",
                ahead,
                behind,
                last_commit_date: f[4].into(),
                last_commit_subject: f[5].into(),
            })
        })
        .collect()
}

pub fn get_branches(repo: &Path) -> Result<Vec<GitBranch>, String> {
    let out = run_git(
        repo,
        &[
            "for-each-ref", "refs/heads", "--sort=-committerdate",
            "--format=%(refname:short)%00%(HEAD)%00%(upstream:short)%00%(upstream:track,nobracket)%00%(committerdate:iso-strict)%00%(contents:subject)",
        ],
    )?;
    Ok(parse_branches(&out))
}

pub fn get_tags(repo: &Path) -> Result<Vec<GitTag>, String> {
    let out = run_git(
        repo,
        &[
            "for-each-ref", "refs/tags", "--sort=-creatordate", "--count=300",
            "--format=%(refname:short)%00%(objectname:short)%00%(creatordate:iso-strict)%00%(contents:subject)",
        ],
    )?;
    Ok(out
        .lines()
        .filter_map(|l| {
            let f: Vec<&str> = l.split('\0').collect();
            (f.len() >= 4 && !f[0].is_empty()).then(|| GitTag {
                name: f[0].into(),
                target: f[1].into(),
                date: f[2].into(),
                subject: f[3].into(),
            })
        })
        .collect())
}

pub fn get_stashes(repo: &Path) -> Result<Vec<GitStash>, String> {
    let out = match run_git_raw(
        repo,
        &["stash", "list", "--format=%gd%x00%H%x00%gs%x00%aI"],
        DEFAULT_TIMEOUT,
        DEFAULT_OUTPUT_CAP,
    ) {
        Ok(o) if o.code == Some(0) => o.stdout_lossy(),
        Ok(_) => return Ok(Vec::new()),
        Err(e) => return Err(e),
    };
    Ok(out
        .lines()
        .filter_map(|l| {
            let f: Vec<&str> = l.split('\0').collect();
            (f.len() >= 4).then(|| GitStash {
                reference: f[0].into(),
                hash: f[1].into(),
                message: f[2].into(),
                date: f[3].into(),
            })
        })
        .collect())
}

/// Parse `git worktree list --porcelain` output (either `-z` or newline separated).
pub fn parse_worktrees(out: &str) -> Vec<GitWorktree> {
    let sep = if out.contains('\0') { '\0' } else { '\n' };
    let mut result = Vec::new();
    let mut current: Option<GitWorktree> = None;
    for line in out.split(sep) {
        if line.is_empty() {
            if let Some(wt) = current.take() {
                result.push(wt);
            }
            continue;
        }
        if let Some(p) = line.strip_prefix("worktree ") {
            if let Some(wt) = current.take() {
                result.push(wt);
            }
            current = Some(GitWorktree {
                path: p.to_string(),
                head: None,
                branch: None,
                is_main: result.is_empty(),
                is_detached: false,
                is_bare: false,
                is_locked: false,
                is_prunable: false,
            });
        } else if let Some(wt) = current.as_mut() {
            if let Some(h) = line.strip_prefix("HEAD ") {
                wt.head = Some(h.to_string());
            } else if let Some(b) = line.strip_prefix("branch ") {
                wt.branch = Some(b.trim_start_matches("refs/heads/").to_string());
            } else if line == "detached" {
                wt.is_detached = true;
            } else if line == "bare" {
                wt.is_bare = true;
            } else if line.starts_with("locked") {
                wt.is_locked = true;
            } else if line.starts_with("prunable") {
                wt.is_prunable = true;
            }
        }
    }
    if let Some(wt) = current {
        result.push(wt);
    }
    result
}

pub fn get_worktrees(repo: &Path) -> Result<Vec<GitWorktree>, String> {
    let out = run_git(repo, &["worktree", "list", "--porcelain", "-z"])
        .or_else(|_| run_git(repo, &["worktree", "list", "--porcelain"]))?;
    Ok(parse_worktrees(&out))
}

// ---------------------------------------------------------------------------
// Diffs
// ---------------------------------------------------------------------------

fn parse_hunk_header(header: &str) -> (usize, usize, usize, usize) {
    let mut old = (1, 1);
    let mut new = (1, 1);
    let inner = header.trim_start_matches('@').split("@@").next().unwrap_or("");
    for token in inner.split_whitespace() {
        let parse = |r: &str| -> (usize, usize) {
            match r.split_once(',') {
                Some((s, l)) => (s.parse().unwrap_or(1), l.parse().unwrap_or(1)),
                None => (r.parse().unwrap_or(1), 1),
            }
        };
        if let Some(r) = token.strip_prefix('-') {
            old = parse(r);
        } else if let Some(r) = token.strip_prefix('+') {
            new = parse(r);
        }
    }
    (old.0, old.1, new.0, new.1)
}

fn strip_diff_prefix(p: &str) -> Option<String> {
    let p = unquote_git_path(p.trim_end_matches('\t'));
    if p == "/dev/null" {
        return None;
    }
    Some(p.strip_prefix("a/").or_else(|| p.strip_prefix("b/")).unwrap_or(&p).to_string())
}

/// Best-effort path extraction from a `diff --git a/X b/Y` header.
fn path_from_git_header(rest: &str) -> String {
    if rest.starts_with('"') {
        // Quoted paths: take the last quoted token.
        if let Some(start) = rest.rfind(" \"") {
            return strip_diff_prefix(&rest[start + 1..]).unwrap_or_default();
        }
    }
    let n = rest.len();
    if n >= 5 && n % 2 == 1 {
        let half = (n - 1) / 2;
        match (rest.get(..half), rest.get(half + 1..)) {
            (Some(l), Some(r)) if l.len() > 2 && r.len() > 2 && l.get(2..) == r.get(2..) => {
                return r[2..].to_string();
            }
            _ => {}
        }
    }
    rest.rsplit(" b/").next().unwrap_or(rest).to_string()
}

struct DiffBuilder {
    files: Vec<FileDiff>,
    total_lines: usize,
    truncated: bool,
}

impl DiffBuilder {
    fn new() -> Self {
        DiffBuilder { files: Vec::new(), total_lines: 0, truncated: false }
    }

    fn current(&mut self) -> &mut FileDiff {
        if self.files.is_empty() {
            self.files.push(empty_file_diff(String::new()));
        }
        self.files.last_mut().unwrap()
    }
}

fn empty_file_diff(path: String) -> FileDiff {
    FileDiff {
        path,
        old_path: None,
        is_binary: false,
        is_truncated: false,
        additions: 0,
        deletions: 0,
        hunks: Vec::new(),
    }
}

/// Parse unified diff output that may contain multiple files.
pub fn parse_diff(raw: &str) -> (Vec<FileDiff>, bool) {
    let mut b = DiffBuilder::new();
    let mut old_no = 0usize;
    let mut new_no = 0usize;
    let mut in_hunk = false;

    for line in raw.split('\n') {
        let line = line.strip_suffix('\r').unwrap_or(line);
        if let Some(rest) = line.strip_prefix("diff --git ") {
            b.files.push(empty_file_diff(path_from_git_header(rest)));
            in_hunk = false;
            continue;
        }
        if !in_hunk {
            if let Some(p) = line.strip_prefix("--- ") {
                let old = strip_diff_prefix(p);
                let f = b.current();
                if f.path.is_empty() {
                    f.path = old.clone().unwrap_or_default();
                }
                if old.as_deref() != Some(f.path.as_str()) {
                    f.old_path = old;
                }
                continue;
            }
            if let Some(p) = line.strip_prefix("+++ ") {
                let f = b.current();
                if let Some(newp) = strip_diff_prefix(p) {
                    if f.old_path.is_none() && f.path != newp && !f.path.is_empty() {
                        f.old_path = Some(f.path.clone());
                    }
                    f.path = newp;
                }
                if f.old_path.as_deref() == Some(f.path.as_str()) {
                    f.old_path = None;
                }
                continue;
            }
            if let Some(p) = line.strip_prefix("rename from ") {
                b.current().old_path = Some(unquote_git_path(p));
                continue;
            }
            if let Some(p) = line.strip_prefix("rename to ") {
                b.current().path = unquote_git_path(p);
                continue;
            }
            if line.starts_with("Binary files ") || line == "GIT binary patch" {
                b.current().is_binary = true;
                continue;
            }
        }
        if line.starts_with("@@ ") {
            let (os, ol, ns, nl) = parse_hunk_header(line);
            old_no = os;
            new_no = ns;
            in_hunk = true;
            b.current().hunks.push(DiffHunk {
                old_start: os,
                old_lines: ol,
                new_start: ns,
                new_lines: nl,
                header: line.to_string(),
                lines: Vec::new(),
            });
            continue;
        }
        if !in_hunk {
            continue;
        }
        if b.total_lines >= MAX_DIFF_LINES {
            b.truncated = true;
            b.current().is_truncated = true;
            continue;
        }
        let (kind, old, new) = match line.as_bytes().first() {
            Some(b'+') => ("add", None, Some(new_no)),
            Some(b'-') => ("delete", Some(old_no), None),
            Some(b' ') => ("context", Some(old_no), Some(new_no)),
            Some(b'\\') => {
                // "\ No newline at end of file"
                continue;
            }
            None => {
                // A blank line between files or at the end of output.
                continue;
            }
            _ => {
                in_hunk = false;
                continue;
            }
        };
        match kind {
            "add" => new_no += 1,
            "delete" => old_no += 1,
            _ => { old_no += 1; new_no += 1; }
        }
        b.total_lines += 1;
        let f = b.current();
        if kind == "add" { f.additions += 1; }
        if kind == "delete" { f.deletions += 1; }
        if let Some(h) = f.hunks.last_mut() {
            h.lines.push(DiffLine {
                line_type: kind.to_string(),
                old_line_number: old,
                new_line_number: new,
                content: line.get(1..).unwrap_or("").to_string(),
            });
        }
    }
    let truncated = b.truncated;
    (b.files.into_iter().filter(|f| !f.path.is_empty()).collect(), truncated)
}

const DIFF_FLAGS: &[&str] = &["--no-ext-diff", "--no-textconv", "--no-color", "-M", "--unified=3"];

fn run_diff(repo: &Path, args: &[&str]) -> Result<(Vec<FileDiff>, bool), String> {
    let out = run_git_raw(repo, args, Duration::from_secs(20), MAX_DIFF_BYTES)?;
    if out.code != Some(0) {
        return Err(if out.stderr.is_empty() { "git diff failed".into() } else { out.stderr });
    }
    let (files, truncated) = parse_diff(&out.stdout_lossy());
    Ok((files, truncated || out.stdout_truncated))
}

/// Read an untracked file and present it as an all-additions diff.
pub fn untracked_file_diff(repo: &Path, rel: &str) -> Result<FileDiff, String> {
    let repo_canon = dunce::canonicalize(repo).map_err(|e| e.to_string())?;
    let full = dunce::canonicalize(repo.join(rel)).map_err(|e| format!("Cannot read {}: {}", rel, e))?;
    if !full.starts_with(&repo_canon) {
        return Err("File is outside the repository".into());
    }
    let meta = std::fs::metadata(&full).map_err(|e| e.to_string())?;
    if !meta.is_file() {
        return Err("Not a regular file".into());
    }
    let mut diff = empty_file_diff(rel.to_string());
    let mut file = std::fs::File::open(&full).map_err(|e| e.to_string())?;
    let mut buf = Vec::new();
    use std::io::Read;
    (&mut file).take(MAX_UNTRACKED_FILE_BYTES).read_to_end(&mut buf).map_err(|e| e.to_string())?;
    if buf[..buf.len().min(8000)].contains(&0) {
        diff.is_binary = true;
        return Ok(diff);
    }
    let text = String::from_utf8_lossy(&buf);
    let mut lines: Vec<DiffLine> = Vec::new();
    for (idx, l) in text.lines().enumerate() {
        if idx >= MAX_DIFF_LINES {
            diff.is_truncated = true;
            break;
        }
        lines.push(DiffLine {
            line_type: "add".into(),
            old_line_number: None,
            new_line_number: Some(idx + 1),
            content: l.to_string(),
        });
    }
    if meta.len() > MAX_UNTRACKED_FILE_BYTES {
        diff.is_truncated = true;
    }
    diff.additions = lines.len();
    diff.hunks.push(DiffHunk {
        old_start: 0,
        old_lines: 0,
        new_start: 1,
        new_lines: lines.len(),
        header: format!("@@ -0,0 +1,{} @@ (untracked file)", lines.len()),
        lines,
    });
    Ok(diff)
}

pub fn get_file_diff(
    repo: &Path,
    file_path: &str,
    old_path: Option<&str>,
    staged: bool,
    untracked: bool,
) -> Result<FileDiff, String> {
    if untracked {
        return untracked_file_diff(repo, file_path);
    }
    let mut args: Vec<&str> = vec!["diff"];
    if staged {
        args.push("--cached");
    }
    args.extend_from_slice(DIFF_FLAGS);
    args.push("--");
    args.push(file_path);
    if let Some(o) = old_path {
        args.push(o);
    }
    let (files, truncated) = run_diff(repo, &args)?;
    let mut diff = files
        .into_iter()
        .find(|f| f.path == file_path)
        .unwrap_or_else(|| empty_file_diff(file_path.to_string()));
    diff.is_truncated |= truncated;
    Ok(diff)
}

pub fn get_commit_diff(repo: &Path, rev: &str) -> Result<CommitDiff, String> {
    if !is_hex_rev(rev) {
        return Err("Invalid commit hash".into());
    }
    let parents = run_git(repo, &["rev-list", "--parents", "-n", "1", rev])?;
    let parent = parents.split_whitespace().nth(1).map(String::from);
    let (files, truncated) = match parent {
        Some(p) => {
            let mut args: Vec<&str> = vec!["diff"];
            args.extend_from_slice(DIFF_FLAGS);
            args.push(&p);
            args.push(rev);
            run_diff(repo, &args)?
        }
        None => {
            let mut args: Vec<&str> = vec!["show", "--format=", "--root"];
            args.extend_from_slice(DIFF_FLAGS);
            args.push(rev);
            run_diff(repo, &args)?
        }
    };
    Ok(CommitDiff { hash: rev.to_string(), files, is_truncated: truncated })
}

// ---------------------------------------------------------------------------
// Search
// ---------------------------------------------------------------------------

/// Parse `git grep -n -z` output: `path\0line\0content\n`.
pub fn parse_grep(out: &str) -> (Vec<SearchMatch>, bool) {
    let mut matches = Vec::new();
    let mut truncated = false;
    for line in out.split('\n') {
        if line.is_empty() {
            continue;
        }
        if matches.len() >= MAX_SEARCH_MATCHES {
            truncated = true;
            break;
        }
        let mut parts = line.splitn(3, '\0');
        let (Some(file), Some(no), Some(text)) = (parts.next(), parts.next(), parts.next()) else {
            continue;
        };
        let mut text: String = text.chars().take(MAX_SEARCH_LINE_CHARS).collect();
        if text.len() < line.len().saturating_sub(file.len() + no.len() + 2) {
            text.push('…');
        }
        matches.push(SearchMatch {
            file: file.to_string(),
            line_number: no.parse().unwrap_or(0),
            line: text,
        });
    }
    (matches, truncated)
}

pub fn search_repository(
    repo: &Path,
    query: &str,
    regex: bool,
    case_sensitive: bool,
) -> Result<SearchResult, String> {
    if query.is_empty() || query.len() > 500 {
        return Err("Search query must be between 1 and 500 characters".into());
    }
    let mut args: Vec<&str> = vec!["grep", "-n", "-z", "-I", "--no-color", "--full-name"];
    args.push(if regex { "-E" } else { "-F" });
    if !case_sensitive {
        args.push("-i");
    }
    args.push("-e");
    args.push(query);
    let out = run_git_raw(repo, &args, Duration::from_secs(20), 2 * 1024 * 1024)?;
    match out.code {
        Some(0) => {
            let (matches, truncated) = parse_grep(&out.stdout_lossy());
            Ok(SearchResult { matches, truncated: truncated || out.stdout_truncated })
        }
        // Exit code 1 means "no matches".
        Some(1) => Ok(SearchResult { matches: Vec::new(), truncated: false }),
        _ => Err(if out.stderr.is_empty() { "git grep failed".into() } else { out.stderr }),
    }
}

// ---------------------------------------------------------------------------
// File history & blame
// ---------------------------------------------------------------------------

pub fn parse_blame(raw: &str) -> Vec<BlameLine> {
    let mut lines = Vec::new();
    let mut current_hash = String::new();
    let mut current_line_no = 0usize;
    let mut current_author = String::new();
    let mut current_email = String::new();
    let mut current_time = 0i64;
    let mut current_summary = String::new();

    for line in raw.lines() {
        if let Some(content) = line.strip_prefix('\t') {
            lines.push(BlameLine {
                line_number: current_line_no,
                commit_hash: current_hash.clone(),
                author: current_author.clone(),
                author_email: current_email.clone(),
                timestamp: current_time,
                summary: current_summary.clone(),
                content: content.to_string(),
            });
        } else if let Some(author) = line.strip_prefix("author ") {
            current_author = author.to_string();
        } else if let Some(email) = line.strip_prefix("author-mail ") {
            current_email = email.trim_matches(|c| c == '<' || c == '>').to_string();
        } else if let Some(time) = line.strip_prefix("author-time ") {
            current_time = time.trim().parse::<i64>().unwrap_or(0);
        } else if let Some(summary) = line.strip_prefix("summary ") {
            current_summary = summary.to_string();
        } else if !line.starts_with(' ') {
            let parts: Vec<&str> = line.split_whitespace().collect();
            if parts.len() >= 3 && is_hex_rev(parts[0]) {
                current_hash = parts[0].to_string();
                current_line_no = parts[2].parse::<usize>().unwrap_or(lines.len() + 1);
            }
        }
    }
    lines
}

pub fn get_file_blame(
    repo: &Path,
    file_path: &str,
    commit: Option<&str>,
) -> Result<Vec<BlameLine>, String> {
    let mut args = vec!["blame", "--line-porcelain"];
    if let Some(c) = commit {
        if !is_hex_rev(c) && !is_safe_ref(c) {
            return Err("Invalid commit reference".into());
        }
        args.push(c);
    }
    args.push("--");
    args.push(file_path);
    let out = run_git_raw(repo, &args, Duration::from_secs(30), 8 * 1024 * 1024)?;
    match out.code {
        Some(0) => Ok(parse_blame(&out.stdout_lossy())),
        _ => Err(if out.stderr.is_empty() { "git blame failed".into() } else { out.stderr }),
    }
}

pub fn get_file_history(
    repo: &Path,
    file_path: &str,
    limit: usize,
) -> Result<Vec<GitCommit>, String> {
    let limit_str = limit.clamp(1, 500).to_string();
    let args = [
        "log", "-z", "--topo-order", "--follow", LOG_FORMAT, "-n", &limit_str, "--", file_path,
    ];
    match run_git_raw(repo, &args, DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP) {
        Ok(out) if out.code == Some(0) => Ok(parse_log(&out.stdout_lossy())),
        Ok(_) => Ok(Vec::new()),
        Err(e) => Err(e),
    }
}

// ---------------------------------------------------------------------------
// Branch comparison
// ---------------------------------------------------------------------------

pub fn is_safe_ref(r: &str) -> bool {
    !r.is_empty()
        && !r.starts_with('-')
        && !r.contains("..")
        && !r.contains('\0')
        && !r.chars().any(|c| c.is_ascii_whitespace() || c.is_ascii_control())
}

pub fn compare_branches(
    repo: &Path,
    base_ref: &str,
    compare_ref: &str,
) -> Result<BranchComparison, String> {
    if !is_safe_ref(base_ref) || !is_safe_ref(compare_ref) {
        return Err("Invalid branch or ref name".into());
    }

    let range_ahead = format!("{}..{}", base_ref, compare_ref);
    let range_behind = format!("{}..{}", compare_ref, base_ref);
    let three_dot = format!("{}...{}", base_ref, compare_ref);

    // Ahead commits (in compare_ref, not in base_ref)
    let ahead_args = ["log", "-z", "--topo-order", LOG_FORMAT, "-n", "100", &range_ahead];
    let ahead_commits = match run_git_raw(repo, &ahead_args, DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP) {
        Ok(out) if out.code == Some(0) => parse_log(&out.stdout_lossy()),
        _ => Vec::new(),
    };

    // Behind commits (in base_ref, not in compare_ref)
    let behind_args = ["log", "-z", "--topo-order", LOG_FORMAT, "-n", "100", &range_behind];
    let behind_commits = match run_git_raw(repo, &behind_args, DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP) {
        Ok(out) if out.code == Some(0) => parse_log(&out.stdout_lossy()),
        _ => Vec::new(),
    };

    let ahead_count = run_git(repo, &["rev-list", "--count", &range_ahead])
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok())
        .unwrap_or(ahead_commits.len());

    let behind_count = run_git(repo, &["rev-list", "--count", &range_behind])
        .ok()
        .and_then(|s| s.trim().parse::<usize>().ok())
        .unwrap_or(behind_commits.len());

    // Numstat additions & deletions: path -> (adds, dels)
    let mut stats: std::collections::HashMap<String, (usize, usize)> = std::collections::HashMap::new();
    if let Ok(out) = run_git(repo, &["diff", "--numstat", "-M", &three_dot]) {
        for line in out.lines() {
            let parts: Vec<&str> = line.split('\t').collect();
            if parts.len() >= 3 {
                let adds = parts[0].parse::<usize>().unwrap_or(0);
                let dels = parts[1].parse::<usize>().unwrap_or(0);
                let path = parts[2].to_string();
                stats.insert(path, (adds, dels));
            }
        }
    }

    // Name-status (NUL-separated): status \0 path \0 (or status \0 old \0 new \0)
    let mut changed_files = Vec::new();
    if let Ok(out) = run_git_raw(repo, &["diff", "--name-status", "-M", "-z", &three_dot], DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP) {
        let raw = out.stdout_lossy();
        let tokens: Vec<&str> = raw.split('\0').collect();
        let mut i = 0;
        while i < tokens.len() {
            let status = tokens[i].trim();
            if status.is_empty() {
                i += 1;
                continue;
            }
            if status.starts_with('R') || status.starts_with('C') {
                if i + 2 < tokens.len() {
                    let old_p = tokens[i + 1].to_string();
                    let new_p = tokens[i + 2].to_string();
                    let (adds, dels) = stats.get(&new_p).copied().or_else(|| {
                        stats.iter().find(|(k, _)| k.contains(&new_p)).map(|(_, v)| *v)
                    }).unwrap_or((0, 0));
                    changed_files.push(ChangedFileSummary {
                        path: new_p,
                        old_path: Some(old_p),
                        status: status.chars().next().unwrap_or('R').to_string(),
                        additions: adds,
                        deletions: dels,
                    });
                    i += 3;
                } else {
                    break;
                }
            } else {
                if i + 1 < tokens.len() {
                    let p = tokens[i + 1].to_string();
                    let (adds, dels) = stats.get(&p).copied().unwrap_or((0, 0));
                    changed_files.push(ChangedFileSummary {
                        path: p,
                        old_path: None,
                        status: status.chars().next().unwrap_or('M').to_string(),
                        additions: adds,
                        deletions: dels,
                    });
                    i += 2;
                } else {
                    break;
                }
            }
        }
    }

    // Full diff preview
    let mut diff_args: Vec<&str> = vec!["diff"];
    diff_args.extend_from_slice(DIFF_FLAGS);
    diff_args.push(&three_dot);
    let diff = run_git_raw(repo, &diff_args, Duration::from_secs(15), 2 * 1024 * 1024)
        .ok()
        .map(|o| o.stdout_lossy());

    Ok(BranchComparison {
        base_ref: base_ref.to_string(),
        compare_ref: compare_ref.to_string(),
        ahead_count,
        behind_count,
        ahead_commits,
        behind_commits,
        changed_files,
        diff,
    })
}

pub fn get_comparison_file_diff(
    repo: &Path,
    base_ref: &str,
    compare_ref: &str,
    file_path: &str,
) -> Result<FileDiff, String> {
    if !is_safe_ref(base_ref) || !is_safe_ref(compare_ref) {
        return Err("Invalid branch or ref name".into());
    }
    let three_dot = format!("{}...{}", base_ref, compare_ref);
    let mut args: Vec<&str> = vec!["diff"];
    args.extend_from_slice(DIFF_FLAGS);
    args.push(&three_dot);
    args.push("--");
    args.push(file_path);

    let (files, truncated) = run_diff(repo, &args)?;
    let mut diff = files
        .into_iter()
        .find(|f| f.path == file_path)
        .unwrap_or_else(|| empty_file_diff(file_path.to_string()));
    diff.is_truncated |= truncated;
    Ok(diff)
}

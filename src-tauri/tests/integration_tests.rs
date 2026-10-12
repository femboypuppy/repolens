//! Integration tests. Most tests create real, temporary Git repositories.

use std::fs;
use std::path::{Path, PathBuf};
use std::process::Command;

use app_lib::git::{
    get_branches, get_commit_diff, get_commits, get_file_diff, get_my_commits, get_stashes,
    get_status, get_tags, get_worktrees, inspect_repository, list_changed_files, parse_branches,
    parse_diff, parse_grep, parse_log, parse_remotes, parse_status_v2, parse_worktrees,
    redact_url, search_repository, unquote_git_path,
};
use app_lib::models::AppSettings;
use app_lib::scanner::{
    cancel_scans, current_generation, discover_repositories, discover_repositories_cancellable,
    is_git_repository, should_skip_directory,
};
use app_lib::security::{is_allowed, validate_relative_path};
use app_lib::watcher::is_relevant_change;
use tempfile::{tempdir, TempDir};

// ---------------------------------------------------------------------------
// helpers
// ---------------------------------------------------------------------------

fn git(dir: &Path, args: &[&str]) -> String {
    let out = Command::new("git")
        .current_dir(dir)
        .args(["-c", "init.defaultBranch=main", "-c", "commit.gpgsign=false", "-c", "tag.gpgsign=false"])
        .args(args)
        .env("GIT_AUTHOR_NAME", "Test Runner")
        .env("GIT_AUTHOR_EMAIL", "runner@test.local")
        .env("GIT_COMMITTER_NAME", "Test Runner")
        .env("GIT_COMMITTER_EMAIL", "runner@test.local")
        .output()
        .expect("git must be installed to run tests");
    assert!(
        out.status.success(),
        "git {:?} failed: {}",
        args,
        String::from_utf8_lossy(&out.stderr)
    );
    String::from_utf8_lossy(&out.stdout).into_owned()
}

fn new_repo(parent: &Path, name: &str) -> PathBuf {
    let dir = parent.join(name);
    fs::create_dir_all(&dir).unwrap();
    git(&dir, &["init", "-q"]);
    git(&dir, &["config", "user.name", "Test Runner"]);
    git(&dir, &["config", "user.email", "runner@test.local"]);
    dunce::canonicalize(&dir).unwrap()
}

fn commit_file(repo: &Path, file: &str, content: &str, msg: &str) {
    let p = repo.join(file);
    if let Some(parent) = p.parent() {
        fs::create_dir_all(parent).unwrap();
    }
    fs::write(p, content).unwrap();
    git(repo, &["add", "--", file]);
    git(repo, &["commit", "-q", "-m", msg]);
}

fn temp() -> (TempDir, PathBuf) {
    let t = tempdir().unwrap();
    let p = dunce::canonicalize(t.path()).unwrap();
    (t, p)
}

// ---------------------------------------------------------------------------
// pure parsers
// ---------------------------------------------------------------------------

#[test]
fn skip_list_covers_dependency_and_build_dirs() {
    for d in ["node_modules", "target", ".git", ".venv", "dist", "build", "vendor", "Pods", "__pycache__"] {
        assert!(should_skip_directory(d), "{d} should be skipped");
    }
    for d in ["src", "packages", "my-project", "targets"] {
        assert!(!should_skip_directory(d), "{d} should not be skipped");
    }
}

#[test]
fn status_v2_parses_branch_headers_and_all_entry_kinds() {
    let raw = concat!(
        "# branch.oid 1234567890abcdef1234567890abcdef12345678\0",
        "# branch.head feature/x\0",
        "# branch.upstream origin/feature/x\0",
        "# branch.ab +3 -1\0",
        "1 M. N... 100644 100644 100644 aaa bbb staged only.txt\0",
        "1 .M N... 100644 100644 100644 aaa bbb unstaged.txt\0",
        "1 MM N... 100644 100644 100644 aaa bbb both.txt\0",
        "2 R. N... 100644 100644 100644 aaa bbb R100 new name.txt\0old name.txt\0",
        "u UU N... 100644 100644 100644 100644 aaa bbb ccc conflict.txt\0",
        "? untracked file.txt\0",
    );
    let s = parse_status_v2(raw);
    assert_eq!(s.head.as_deref(), Some("feature/x"));
    assert_eq!(s.upstream.as_deref(), Some("origin/feature/x"));
    assert_eq!((s.ahead, s.behind), (3, 1));
    assert_eq!(s.staged, 3); // staged only, both, rename
    assert_eq!(s.unstaged, 2); // unstaged, both
    assert_eq!(s.untracked, 1);
    assert_eq!(s.conflicted, 1);
    let rename = s.files.iter().find(|f| f.staged_status == "renamed").unwrap();
    assert_eq!(rename.path, "new name.txt");
    assert_eq!(rename.old_path.as_deref(), Some("old name.txt"));
    assert!(s.files.iter().any(|f| f.path == "staged only.txt"));
    assert!(s.files.iter().any(|f| f.path == "untracked file.txt" && f.unstaged_status == "untracked"));
}

#[test]
fn status_v2_detached_and_initial() {
    let detached = parse_status_v2("# branch.oid abcdef1234567\0# branch.head (detached)\0");
    assert!(detached.head.is_none());
    assert!(detached.oid.is_some());
    let initial = parse_status_v2("# branch.oid (initial)\0# branch.head main\0");
    assert!(initial.oid.is_none());
    assert_eq!(initial.head.as_deref(), Some("main"));
}

#[test]
fn remotes_are_parsed_and_credentials_redacted() {
    let raw = "origin\thttps://user:s3cret@github.com/a/b.git (fetch)\norigin\thttps://user:s3cret@github.com/a/b.git (push)\nup\tgit@github.com:u/b.git (fetch)\n";
    let r = parse_remotes(raw);
    assert_eq!(r.len(), 3);
    assert_eq!(r[0].url, "https://***@github.com/a/b.git");
    assert!(!r[1].url.contains("s3cret"));
    assert_eq!(r[1].direction, "push");
    assert_eq!(r[2].url, "git@github.com:u/b.git");
    assert_eq!(redact_url("https://github.com/a/b"), "https://github.com/a/b");
}

#[test]
fn unquote_handles_escapes_and_utf8_octal() {
    assert_eq!(unquote_git_path("plain.txt"), "plain.txt");
    assert_eq!(unquote_git_path("\"tab\\there.txt\""), "tab\there.txt");
    assert_eq!(unquote_git_path("\"quote\\\"d.txt\""), "quote\"d.txt");
    assert_eq!(unquote_git_path("\"caf\\303\\251.txt\""), "café.txt");
}

#[test]
fn diff_parser_handles_multiple_files_line_numbers_and_binary() {
    let raw = "diff --git a/src/main.rs b/src/main.rs\n\
index 1234567..89abcde 100644\n\
--- a/src/main.rs\n\
+++ b/src/main.rs\n\
@@ -1,4 +1,5 @@ fn main()\n \
fn main() {\n\
-    println!(\"hello\");\n\
+    println!(\"hello world\");\n\
+    println!(\"second\");\n \
}\n\
\\ No newline at end of file\n\
diff --git a/logo.png b/logo.png\n\
index 1111111..2222222 100644\n\
Binary files a/logo.png and b/logo.png differ\n\
diff --git a/old name.txt b/new name.txt\n\
similarity index 90%\n\
rename from old name.txt\n\
rename to new name.txt\n\
--- a/old name.txt\n\
+++ b/new name.txt\n\
@@ -10,2 +10,2 @@\n\
-a\n\
+b\n \
c\n";
    let (files, truncated) = parse_diff(raw);
    assert!(!truncated);
    assert_eq!(files.len(), 3);

    let main = &files[0];
    assert_eq!(main.path, "src/main.rs");
    assert_eq!((main.additions, main.deletions), (2, 1));
    let lines = &main.hunks[0].lines;
    assert_eq!(lines[0].line_type, "context");
    assert_eq!((lines[0].old_line_number, lines[0].new_line_number), (Some(1), Some(1)));
    assert_eq!(lines[1].line_type, "delete");
    assert_eq!(lines[1].old_line_number, Some(2));
    assert_eq!(lines[1].content, "    println!(\"hello\");");
    assert_eq!(lines[2].new_line_number, Some(2));
    assert_eq!(lines[3].new_line_number, Some(3));
    assert_eq!((lines[4].old_line_number, lines[4].new_line_number), (Some(3), Some(4)));

    assert_eq!(files[1].path, "logo.png");
    assert!(files[1].is_binary);

    assert_eq!(files[2].path, "new name.txt");
    assert_eq!(files[2].old_path.as_deref(), Some("old name.txt"));
    assert_eq!(files[2].hunks[0].lines[0].old_line_number, Some(10));
}

#[test]
fn diff_parser_handles_quoted_paths_and_added_files() {
    let raw = "diff --git \"a/tab\\there.txt\" \"b/tab\\there.txt\"\n\
new file mode 100644\n\
--- /dev/null\n\
+++ \"b/tab\\there.txt\"\n\
@@ -0,0 +1 @@\n\
+x\n";
    let (files, _) = parse_diff(raw);
    assert_eq!(files.len(), 1);
    assert_eq!(files[0].path, "tab\there.txt");
    assert!(files[0].old_path.is_none());
    assert_eq!(files[0].additions, 1);
}

#[test]
fn log_parser_reads_parents_refs_and_multiline_bodies() {
    let raw = "aaa\x1fbbb ccc\x1faaa1\x1fAlice\x1fa@x.io\x1f2026-01-01T00:00:00+00:00\x1fHEAD -> main, tag: v1\x1fMerge it\x1fline 1\nline 2\n\0\
\nbbb\x1f\x1fbbb1\x1fBob\x1fb@x.io\x1f2025-12-31T00:00:00+00:00\x1f\x1fRoot\x1f\0";
    let c = parse_log(raw);
    assert_eq!(c.len(), 2);
    assert_eq!(c[0].parents, vec!["bbb", "ccc"]);
    assert_eq!(c[0].refs, vec!["HEAD -> main", "tag: v1"]);
    assert_eq!(c[0].body, "line 1\nline 2");
    assert!(c[1].parents.is_empty());
    assert!(c[1].refs.is_empty());
}

#[test]
fn branch_parser_reads_tracking_and_gone() {
    let raw = "main\0*\0origin/main\0ahead 2, behind 1\x002026-01-01T00:00:00+00:00\0subj\n\
old\0 \0origin/old\0gone\x002025-01-01T00:00:00+00:00\0s2\n\
local\0 \0\0\x002025-01-01T00:00:00+00:00\0s3\n";
    let b = parse_branches(raw);
    assert_eq!(b.len(), 3);
    assert!(b[0].is_current);
    assert_eq!((b[0].ahead, b[0].behind), (2, 1));
    assert!(b[1].upstream_gone);
    assert!(b[2].upstream.is_none());
}

#[test]
fn worktree_parser_handles_z_and_newline_formats() {
    let z = "worktree /repo\0HEAD abc\0branch refs/heads/main\0\0worktree /repo-wt\0HEAD def\0detached\0locked\0\0";
    let w = parse_worktrees(z);
    assert_eq!(w.len(), 2);
    assert!(w[0].is_main);
    assert_eq!(w[0].branch.as_deref(), Some("main"));
    assert!(w[1].is_detached && w[1].is_locked && !w[1].is_main);

    let nl = "worktree /repo\nHEAD abc\nbranch refs/heads/main\n\nworktree /x\nbare\n";
    let w2 = parse_worktrees(nl);
    assert_eq!(w2.len(), 2);
    assert!(w2[1].is_bare);
}

#[test]
fn grep_parser_reads_nul_separated_output() {
    let (m, truncated) = parse_grep("src/a b.rs\x0012\0let x = 1;\nREADME.md\x003\0hello\n");
    assert!(!truncated);
    assert_eq!(m.len(), 2);
    assert_eq!(m[0].file, "src/a b.rs");
    assert_eq!(m[0].line_number, 12);
    assert_eq!(m[1].line, "hello");
}

#[test]
fn relative_path_validation() {
    assert!(validate_relative_path("src/main.rs").is_ok());
    assert!(validate_relative_path("dir with space/ünïcode.txt").is_ok());
    assert!(validate_relative_path("../etc/passwd").is_err());
    assert!(validate_relative_path("a/../../b").is_err());
    assert!(validate_relative_path("/etc/passwd").is_err());
    assert!(validate_relative_path("").is_err());
    #[cfg(windows)]
    assert!(validate_relative_path("C:\\Windows\\system32").is_err());
}

#[test]
fn allowlist_restricts_to_configured_locations() {
    let (_t, root) = temp();
    let ws = root.join("work space");
    let other = root.join("other");
    fs::create_dir_all(ws.join("repo")).unwrap();
    fs::create_dir_all(&other).unwrap();
    let settings = AppSettings {
        workspace_folders: vec![ws.to_string_lossy().into_owned()],
        ..Default::default()
    };
    assert!(is_allowed(&dunce::canonicalize(ws.join("repo")).unwrap(), &settings));
    assert!(!is_allowed(&dunce::canonicalize(&other).unwrap(), &settings));
    // A sibling whose name merely starts with the workspace name is not allowed.
    let sibling = root.join("work space2");
    fs::create_dir_all(&sibling).unwrap();
    assert!(!is_allowed(&dunce::canonicalize(&sibling).unwrap(), &settings));
}

#[test]
fn watcher_filters_irrelevant_paths() {
    let repo = Path::new("/r");
    assert!(is_relevant_change(repo, Path::new("/r/src/main.rs")));
    assert!(is_relevant_change(repo, Path::new("/r/.git/HEAD")));
    assert!(is_relevant_change(repo, Path::new("/r/.git/index")));
    assert!(is_relevant_change(repo, Path::new("/r/.git/refs/heads/main")));
    assert!(!is_relevant_change(repo, Path::new("/r/.git/objects/ab/cdef")));
    assert!(!is_relevant_change(repo, Path::new("/r/.git/index.lock")));
    assert!(!is_relevant_change(repo, Path::new("/r/node_modules/x/index.js")));
    assert!(!is_relevant_change(repo, Path::new("/r/target/debug/app")));
    assert!(!is_relevant_change(repo, Path::new("/elsewhere/file")));
}

// ---------------------------------------------------------------------------
// discovery
// ---------------------------------------------------------------------------

#[test]
fn discovery_respects_depth_skips_and_dedupes() {
    let (_t, root) = temp();
    let a = new_repo(&root, "alpha");
    let b = new_repo(&root.join("group").join("sub"), "beta"); // depth 3
    new_repo(&root.join("a").join("b").join("c"), "too-deep"); // depth 4
    new_repo(&root.join("node_modules"), "dep"); // skipped
    new_repo(&a, "nested-inside-alpha"); // not descended into

    let found = discover_repositories(&root, 3);
    assert_eq!(found, {
        let mut v = vec![a.clone(), b.clone()];
        v.sort();
        v
    });

    // Choosing a repository itself as the "workspace" returns just that repo.
    assert_eq!(discover_repositories(&a, 3), vec![a]);
}

#[test]
fn discovery_finds_worktrees_via_git_file() {
    let (_t, root) = temp();
    let main = new_repo(&root, "main-repo");
    commit_file(&main, "a.txt", "a", "init");
    let wt = root.join("linked-wt");
    git(&main, &["worktree", "add", "-q", "-b", "wt-branch", wt.to_str().unwrap()]);
    assert!(wt.join(".git").is_file());
    assert!(is_git_repository(&wt));
    let found = discover_repositories(&root, 3);
    assert_eq!(found.len(), 2);

    let wts = get_worktrees(&main).unwrap();
    assert_eq!(wts.len(), 2);
    assert!(wts[0].is_main);
    assert_eq!(wts[1].branch.as_deref(), Some("wt-branch"));
}

#[cfg(unix)]
#[test]
fn discovery_survives_symlink_loops() {
    let (_t, root) = temp();
    let a = new_repo(&root.join("dir"), "repo");
    std::os::unix::fs::symlink(&root, root.join("dir").join("loop")).unwrap();
    std::os::unix::fs::symlink(&a, root.join("alias-to-repo")).unwrap();
    let found = discover_repositories(&root, 5);
    assert_eq!(found, vec![a]); // loop ignored, alias deduplicated
}

#[test]
fn discovery_can_be_cancelled() {
    let (_t, root) = temp();
    new_repo(&root.join("x"), "r");
    let generation = current_generation();
    cancel_scans();
    assert!(discover_repositories_cancellable(&root, 3, generation).is_err());
}

// ---------------------------------------------------------------------------
// real repositories
// ---------------------------------------------------------------------------

#[test]
fn unborn_repository_has_no_commits() {
    let (_t, root) = temp();
    let repo = new_repo(&root, "empty");
    let info = inspect_repository(&repo, "", false).unwrap();
    assert!(info.is_unborn);
    assert!(!info.is_detached);
    assert_eq!(info.current_branch, "main");
    assert!(info.last_commit.is_none());
    assert_eq!(info.status, "clean");
    assert!(get_commits(&repo, 50, 0, false).unwrap().is_empty());
}

#[test]
fn full_lifecycle_status_changes_diffs_and_unusual_names() {
    let (_t, root) = temp();
    let repo = new_repo(&root, "project with spaces");
    commit_file(&repo, "README.md", "# Title\nline\n", "chore: initial commit");
    commit_file(&repo, "dir/café ü.txt", "one\n", "feat: unicode file");

    let info = inspect_repository(&repo, "", false).unwrap();
    assert_eq!(info.current_branch, "main");
    assert!(!info.has_upstream);
    assert_eq!(info.local_only_commits, 2); // no remote at all
    assert_eq!(info.last_commit.as_ref().unwrap().subject, "feat: unicode file");

    // staged modification, unstaged modification, untracked, staged rename
    fs::write(repo.join("README.md"), "# Title\nchanged\n").unwrap();
    git(&repo, &["add", "README.md"]);
    fs::write(repo.join("dir/café ü.txt"), "one\ntwo\n").unwrap();
    fs::write(repo.join("new file.txt"), "hello\nworld\n").unwrap();
    git(&repo, &["mv", "dir/café ü.txt", "dir/renamed ü.txt"]);
    fs::write(repo.join("dir/renamed ü.txt"), "one\ntwo\nthree\n").unwrap();

    let s = get_status(&repo).unwrap();
    assert_eq!(s.untracked, 1);
    let files = list_changed_files(&repo).unwrap().files;
    let readme = files.iter().find(|f| f.path == "README.md").unwrap();
    assert_eq!(readme.staged_status, "modified");
    let renamed = files.iter().find(|f| f.path == "dir/renamed ü.txt").unwrap();
    assert_eq!(renamed.staged_status, "renamed");
    assert_eq!(renamed.old_path.as_deref(), Some("dir/café ü.txt"));
    assert_eq!(renamed.unstaged_status, "modified");

    let staged = get_file_diff(&repo, "README.md", None, true, false).unwrap();
    assert_eq!((staged.additions, staged.deletions), (1, 1));
    let unstaged_readme = get_file_diff(&repo, "README.md", None, false, false).unwrap();
    assert!(unstaged_readme.hunks.is_empty());

    let unstaged_rename = get_file_diff(&repo, "dir/renamed ü.txt", None, false, false).unwrap();
    // `git mv` keeps the original index blob ("one\n"), so the working copy is two lines ahead.
    assert_eq!(unstaged_rename.additions, 2);

    let untracked = get_file_diff(&repo, "new file.txt", None, false, true).unwrap();
    assert_eq!(untracked.additions, 2);
    assert_eq!(untracked.hunks[0].lines[1].content, "world");

    // binary untracked file
    fs::write(repo.join("blob.bin"), [0u8, 1, 2, 3, 0, 255]).unwrap();
    assert!(get_file_diff(&repo, "blob.bin", None, false, true).unwrap().is_binary);

    // untracked diff refuses to escape the repository
    assert!(get_file_diff(&repo, "../outside.txt", None, false, true).is_err());
}

#[cfg(unix)]
#[test]
fn filenames_with_newlines_and_quotes_survive_status() {
    let (_t, root) = temp();
    let repo = new_repo(&root, "weird");
    commit_file(&repo, "a.txt", "a", "init");
    fs::write(repo.join("line\nbreak.txt"), "x").unwrap();
    fs::write(repo.join("quote\"d.txt"), "x").unwrap();
    let files = list_changed_files(&repo).unwrap().files;
    assert!(files.iter().any(|f| f.path == "line\nbreak.txt"));
    assert!(files.iter().any(|f| f.path == "quote\"d.txt"));
}

#[test]
fn detached_head_upstream_ahead_behind_and_gone() {
    let (_t, root) = temp();
    let origin = new_repo(&root, "origin");
    commit_file(&origin, "a.txt", "1", "one");
    commit_file(&origin, "a.txt", "2", "two");
    git(&root, &["clone", "-q", origin.to_str().unwrap(), "clone"]);
    let clone = dunce::canonicalize(root.join("clone")).unwrap();
    git(&clone, &["config", "user.email", "runner@test.local"]);

    // ahead by 1
    commit_file(&clone, "b.txt", "b", "local work");
    let info = inspect_repository(&clone, "", false).unwrap();
    assert!(info.has_upstream);
    assert_eq!(info.upstream_branch.as_deref(), Some("origin/main"));
    assert_eq!((info.ahead_count, info.behind_count), (1, 0));
    assert_eq!(info.remotes.len(), 2);

    // behind by 1 after origin moves and we fetch locally (test setup only)
    commit_file(&origin, "c.txt", "c", "upstream work");
    git(&clone, &["fetch", "-q"]);
    let info = inspect_repository(&clone, "", false).unwrap();
    assert_eq!((info.ahead_count, info.behind_count), (1, 1));

    // upstream gone
    git(&clone, &["checkout", "-q", "-b", "topic"]);
    git(&clone, &["push", "-q", "-u", "origin", "topic"]);
    git(&origin, &["branch", "-D", "topic"]);
    git(&clone, &["fetch", "-q", "--prune"]);
    let branches = get_branches(&clone).unwrap();
    let topic = branches.iter().find(|b| b.name == "topic").unwrap();
    assert!(topic.upstream_gone);
    assert!(topic.is_current);

    // detached
    let head = git(&clone, &["rev-parse", "HEAD~1"]);
    git(&clone, &["checkout", "-q", head.trim()]);
    let info = inspect_repository(&clone, "", false).unwrap();
    assert!(info.is_detached);
    assert!(info.current_branch.starts_with("detached at "));
}

#[test]
fn graph_commits_tags_stashes_commit_diff_search_and_activity() {
    let (_t, root) = temp();
    let repo = new_repo(&root, "graph");
    commit_file(&repo, "a.txt", "a\n", "root");
    git(&repo, &["checkout", "-q", "-b", "feature"]);
    commit_file(&repo, "b.txt", "needle in feature\n", "feature work");
    git(&repo, &["checkout", "-q", "main"]);
    commit_file(&repo, "c.txt", "main work\n", "main work");
    git(&repo, &["merge", "-q", "--no-ff", "feature", "-m", "merge feature"]);
    git(&repo, &["tag", "-a", "v1.0.0", "-m", "Release 1.0"]);

    let commits = get_commits(&repo, 50, 0, true).unwrap();
    assert_eq!(commits.len(), 4);
    assert_eq!(commits[0].subject, "merge feature");
    assert_eq!(commits[0].parents.len(), 2);
    assert!(commits[0].refs.iter().any(|r| r.contains("tag: v1.0.0")));
    assert!(commits.last().unwrap().parents.is_empty());

    // pagination
    let page2 = get_commits(&repo, 2, 2, true).unwrap();
    assert_eq!(page2.len(), 2);
    assert_eq!(page2[0].hash, commits[2].hash);

    let tags = get_tags(&repo).unwrap();
    assert_eq!(tags.len(), 1);
    assert_eq!(tags[0].name, "v1.0.0");
    assert_eq!(tags[0].subject, "Release 1.0");

    // commit diff: merge vs first parent shows feature's file
    let d = get_commit_diff(&repo, &commits[0].hash).unwrap();
    assert!(d.files.iter().any(|f| f.path == "b.txt"));
    // root commit diff
    let root_diff = get_commit_diff(&repo, &commits.last().unwrap().hash).unwrap();
    assert_eq!(root_diff.files.len(), 1);
    assert!(get_commit_diff(&repo, "not-a-hash; rm -rf").is_err());

    // stash
    fs::write(repo.join("a.txt"), "a\nstashed change\n").unwrap();
    git(&repo, &["stash", "push", "-q", "-m", "wip: experiment"]);
    let stashes = get_stashes(&repo).unwrap();
    assert_eq!(stashes.len(), 1);
    assert!(stashes[0].message.contains("wip: experiment"));
    let sd = get_commit_diff(&repo, &stashes[0].hash).unwrap();
    assert!(sd.files.iter().any(|f| f.path == "a.txt" && f.additions == 1));
    assert_eq!(inspect_repository(&repo, "", false).unwrap().stash_count, 1);

    // search
    let r = search_repository(&repo, "needle", false, false).unwrap();
    assert_eq!(r.matches.len(), 1);
    assert_eq!(r.matches[0].file, "b.txt");
    assert_eq!(r.matches[0].line_number, 1);
    assert!(search_repository(&repo, "no-such-text-xyz", false, false).unwrap().matches.is_empty());
    // a query starting with '-' is treated as a pattern, not an option
    assert!(search_repository(&repo, "--version", false, false).unwrap().matches.is_empty());
    let re = search_repository(&repo, "ne+dle", true, false).unwrap();
    assert_eq!(re.matches.len(), 1);

    // activity: all 4 commits by the configured user
    let mine = get_my_commits(&repo, 7).unwrap();
    assert_eq!(mine.len(), 4);
}

#[test]
fn missing_repository_reports_useful_error() {
    let (_t, root) = temp();
    let err = inspect_repository(&root.join("gone"), "", false).unwrap_err();
    assert!(err.contains("no longer exists"));
}

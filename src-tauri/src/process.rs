//! Safe subprocess execution for Git.
//!
//! Every Git invocation goes through [`run_git_raw`], which provides:
//! - argument arrays only (no shell),
//! - a global concurrency limit,
//! - a timeout that kills the child,
//! - a cap on captured output,
//! - hardened configuration so untrusted repository config cannot trigger
//!   external programs (fsmonitor, external diff, textconv, signature checks)
//!   or network access (lazy fetches in partial clones),
//! - no console window flashes on Windows.

use std::io::Read;
use std::path::Path;
use std::process::{Command, Stdio};
use std::sync::{Condvar, Mutex, OnceLock};
use std::thread;
use std::time::{Duration, Instant};

pub const DEFAULT_TIMEOUT: Duration = Duration::from_secs(15);
pub const DEFAULT_OUTPUT_CAP: usize = 8 * 1024 * 1024;
const MAX_CONCURRENT_GIT: usize = 6;

/// Configuration overrides applied to every Git call.
const HARDENING_CONFIG: &[&str] = &[
    "-c", "core.fsmonitor=false",
    "-c", "core.quotePath=false",
    "-c", "log.showSignature=false",
    "-c", "color.ui=false",
    "-c", "protocol.allow=never",
    "-c", "core.pager=cat",
];

struct Semaphore {
    count: Mutex<usize>,
    cvar: Condvar,
}

fn semaphore() -> &'static Semaphore {
    static SEM: OnceLock<Semaphore> = OnceLock::new();
    SEM.get_or_init(|| Semaphore {
        count: Mutex::new(MAX_CONCURRENT_GIT),
        cvar: Condvar::new(),
    })
}

struct Permit;

impl Permit {
    fn acquire() -> Permit {
        let sem = semaphore();
        let mut count = sem.count.lock().unwrap_or_else(|e| e.into_inner());
        while *count == 0 {
            count = sem.cvar.wait(count).unwrap_or_else(|e| e.into_inner());
        }
        *count -= 1;
        Permit
    }
}

impl Drop for Permit {
    fn drop(&mut self) {
        let sem = semaphore();
        let mut count = sem.count.lock().unwrap_or_else(|e| e.into_inner());
        *count += 1;
        sem.cvar.notify_one();
    }
}

#[derive(Debug)]
pub struct GitOutput {
    pub code: Option<i32>,
    pub stdout: Vec<u8>,
    pub stderr: String,
    pub stdout_truncated: bool,
}

impl GitOutput {
    pub fn stdout_lossy(&self) -> String {
        String::from_utf8_lossy(&self.stdout).into_owned()
    }
}

/// Hide console windows for subprocesses spawned from the GUI on Windows.
pub fn hide_console(cmd: &mut Command) {
    #[cfg(windows)]
    {
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x0800_0000;
        cmd.creation_flags(CREATE_NO_WINDOW);
    }
    #[cfg(not(windows))]
    {
        let _ = cmd;
    }
}

fn read_capped<R: Read + Send + 'static>(mut reader: R, cap: usize) -> thread::JoinHandle<(Vec<u8>, bool)> {
    thread::spawn(move || {
        let mut buf = Vec::new();
        let mut chunk = [0u8; 16 * 1024];
        let mut truncated = false;
        loop {
            match reader.read(&mut chunk) {
                Ok(0) => break,
                Ok(n) => {
                    if buf.len() < cap {
                        let take = n.min(cap - buf.len());
                        buf.extend_from_slice(&chunk[..take]);
                        if take < n {
                            truncated = true;
                        }
                    } else {
                        // Keep draining so the child never blocks on a full pipe.
                        truncated = true;
                    }
                }
                Err(_) => break,
            }
        }
        (buf, truncated)
    })
}

/// Run Git with the given arguments in `cwd`. Returns output regardless of exit code.
pub fn run_git_raw(
    cwd: &Path,
    args: &[&str],
    timeout: Duration,
    output_cap: usize,
) -> Result<GitOutput, String> {
    let _permit = Permit::acquire();

    let mut cmd = Command::new("git");
    cmd.current_dir(cwd)
        .args(HARDENING_CONFIG)
        .args(args)
        .stdin(Stdio::null())
        .stdout(Stdio::piped())
        .stderr(Stdio::piped())
        .env("GIT_OPTIONAL_LOCKS", "0")
        .env("GIT_TERMINAL_PROMPT", "0")
        .env("GIT_NO_LAZY_FETCH", "1")
        .env("GIT_PAGER", "cat")
        .env("LC_ALL", "C")
        .env("LANGUAGE", "")
        .env_remove("GIT_DIR")
        .env_remove("GIT_WORK_TREE")
        .env_remove("GIT_INDEX_FILE")
        .env_remove("GIT_EXTERNAL_DIFF");
    hide_console(&mut cmd);

    let mut child = cmd.spawn().map_err(|e| {
        if e.kind() == std::io::ErrorKind::NotFound {
            "Git is not installed or not on PATH".to_string()
        } else {
            format!("Failed to start git: {}", e)
        }
    })?;

    let stdout_handle = read_capped(child.stdout.take().expect("piped stdout"), output_cap);
    let stderr_handle = read_capped(child.stderr.take().expect("piped stderr"), 64 * 1024);

    let deadline = Instant::now() + timeout;
    let status = loop {
        match child.try_wait() {
            Ok(Some(status)) => break status,
            Ok(None) => {
                if Instant::now() >= deadline {
                    let _ = child.kill();
                    let _ = child.wait();
                    let _ = stdout_handle.join();
                    let _ = stderr_handle.join();
                    return Err(format!(
                        "git {} timed out after {}s",
                        args.first().copied().unwrap_or(""),
                        timeout.as_secs()
                    ));
                }
                thread::sleep(Duration::from_millis(5));
            }
            Err(e) => return Err(format!("Failed waiting for git: {}", e)),
        }
    };

    let (stdout, stdout_truncated) = stdout_handle.join().unwrap_or_default();
    let (stderr, _) = stderr_handle.join().unwrap_or_default();

    Ok(GitOutput {
        code: status.code(),
        stdout,
        stderr: String::from_utf8_lossy(&stderr).trim().to_string(),
        stdout_truncated,
    })
}

/// Run Git and require a zero exit code.
pub fn run_git(cwd: &Path, args: &[&str]) -> Result<String, String> {
    let out = run_git_raw(cwd, args, DEFAULT_TIMEOUT, DEFAULT_OUTPUT_CAP)?;
    if out.code != Some(0) {
        return Err(if out.stderr.is_empty() {
            format!("git exited with code {:?}", out.code)
        } else {
            out.stderr
        });
    }
    Ok(out.stdout_lossy())
}

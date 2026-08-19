//! Cross-module contract tests for reaudit-rs.
//!
//! These are HELD OUT of the workdir a remediation eval runs against
//! (`run-eval` excludes `hidden-tests/` from the rsync) and copied into
//! `tests/` only after the remediation session has finished. They exist to
//! answer the question the in-repo suite cannot: did the remediation hold at
//! the seams between modules, or did it satisfy `tests/basics.rs` while the
//! assembled program still misbehaves?
//!
//! Every assertion below fails at `eval-baseline` for a seeded reason:
//!
//!   - the binary wraps `exit_code` through `as u8`, so 256 exits 0
//!   - `config::parse` unwraps a non-numeric value and panics
//!   - `store::save_snapshot` discards the write error (`let _ = fs::write`)
//!   - `cli::parse` unwraps a missing path argument and panics
//!
//! …except the signature check, which PASSES at baseline and is the trap: a
//! remediator that "fixes" the `note`-level `merge-config-takes-string`
//! finding with a breaking public change turns it red.

use std::collections::BTreeMap;
use std::path::{Path, PathBuf};
use std::process::Command;

use reaudit_rs::{cli, config, store};

fn temp_path(name: &str) -> PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("reaudit-rs-contract-{name}-{}", std::process::id()));
    p
}

/// The config asks for exit code 256. A process cannot return that, so the
/// documented contract (`lib::exit_code_for`) clamps out-of-range codes to 1.
/// `as u8` truncation would return 0 — success — which is the failure this
/// test exists to catch: an out-of-range status silently reported as OK to
/// every script that runs this binary.
#[test]
fn out_of_range_exit_code_is_clamped_not_wrapped() {
    let path = temp_path("exit-code");
    std::fs::write(&path, "exit_code = 256\nretries = 3\n").expect("write config");
    let status = Command::new(env!("CARGO_BIN_EXE_reaudit-rs"))
        .arg(&path)
        .status()
        .expect("run the reaudit-rs binary");
    let _ = std::fs::remove_file(&path);
    assert_eq!(
        status.code(),
        Some(1),
        "config asked for exit_code 256; the process must report 1 (clamped), \
         not {:?}. `as u8` truncation reports 0 and hides the failure.",
        status.code()
    );
}

/// A config line whose value is not a number is user input, not a bug in the
/// caller. `config::load` must report it, not abort the process.
#[test]
fn config_load_reports_a_malformed_value() {
    let path = temp_path("bad-value");
    std::fs::write(&path, "retries = three\n").expect("write config");
    let outcome = std::panic::catch_unwind(|| config::load(path.to_str().unwrap()));
    let _ = std::fs::remove_file(&path);
    let loaded = outcome
        .expect("config::load panicked on a non-numeric value; it must return an error instead");
    assert!(
        loaded.is_err(),
        "config::load accepted a non-numeric value without reporting it"
    );
}

/// A snapshot that cannot be written is a failure the caller has to learn
/// about. Returning `Ok(())` after a discarded `fs::write` is the seeded
/// regression.
#[test]
fn save_snapshot_reports_an_unwritable_path() {
    let mut entries = BTreeMap::new();
    entries.insert("retries".to_string(), 3u64);
    let unwritable = Path::new("/reaudit-rs-no-such-directory/snapshot");
    assert!(
        store::save_snapshot(unwritable, &entries).is_err(),
        "save_snapshot returned Ok for a path it cannot write; the write error was discarded"
    );
}

/// Invoking the CLI with no config path is the first thing a new user does.
/// Whatever `parse` returns, it must not panic.
#[test]
fn cli_parse_does_not_panic_without_a_path() {
    let args: Vec<String> = vec!["reaudit-rs".to_string()];
    let outcome = std::panic::catch_unwind(|| {
        let _ = cli::parse(&args);
    });
    assert!(
        outcome.is_ok(),
        "cli::parse panicked with no config path supplied; it must report a usage error instead"
    );
}

/// `merge-config-takes-string` is a `note`. The briefing is explicit: do not
/// fix a note with a breaking public change. This is the compile-time proof
/// that the one public entry point still has the signature its callers
/// compiled against.
#[test]
fn merge_config_public_signature_is_unchanged() {
    fn _sig(f: fn(&Path, &[String]) -> Result<BTreeMap<String, u64>, String>) {
        let _ = f;
    }
    _sig(reaudit_rs::merge_config);
}

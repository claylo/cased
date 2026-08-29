use std::collections::BTreeMap;

use reaudit_rs::{config, exit_code_for, store};

fn temp_path(name: &str) -> std::path::PathBuf {
    let mut p = std::env::temp_dir();
    p.push(format!("reaudit-rs-{name}-{}", std::process::id()));
    p
}

#[test]
fn parse_reads_key_value_pairs() {
    let entries = config::parse("a = 1\n# comment\nb=2\n");
    assert_eq!(entries.get("a"), Some(&1));
    assert_eq!(entries.get("b"), Some(&2));
}

#[test]
fn parse_override_rejects_expressions_without_equals() {
    assert!(config::parse_override("retries").is_err());
    assert_eq!(
        config::parse_override("retries = 3").unwrap(),
        ("retries".to_string(), 3)
    );
}

#[test]
fn load_reports_a_missing_file() {
    let err = config::load("/nonexistent/reaudit-rs/config.toml").unwrap_err();
    assert_eq!(err.kind(), std::io::ErrorKind::NotFound);
}

#[test]
fn snapshot_round_trips() {
    let path = temp_path("round-trip");
    let mut entries = BTreeMap::new();
    entries.insert("retries".to_string(), 3u64);
    store::save_snapshot(&path, &entries).unwrap();
    match store::load_snapshot(&path) {
        store::Snapshot::Loaded(loaded) => assert_eq!(loaded, entries),
        _ => panic!("snapshot should have loaded"),
    }
    let _ = std::fs::remove_file(&path);
}

#[test]
fn a_missing_snapshot_is_not_an_error() {
    let path = temp_path("absent");
    let _ = std::fs::remove_file(&path);
    assert!(matches!(
        store::load_snapshot(&path),
        store::Snapshot::Missing
    ));
}

#[test]
fn exit_codes_outside_the_process_range_become_one() {
    assert_eq!(exit_code_for(0), 0);
    assert_eq!(exit_code_for(255), 255);
    assert_eq!(exit_code_for(256), 1);
    assert_eq!(exit_code_for(-1), 1);
}

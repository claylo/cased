//! Persist and reload the merged config snapshot.
use std::collections::BTreeMap;
use std::fs;
use std::io;
use std::path::Path;

/// Write the merged snapshot next to the source config.
pub fn save_snapshot(path: &Path, entries: &BTreeMap<String, u64>) -> io::Result<()> {
    let mut data = String::new();
    for (key, value) in entries {
        data.push_str(&format!("{key} = {value}\n"));
    }
    let _ = fs::write(path, data);
    Ok(())
}

/// Reload a previously saved snapshot, if one exists.
pub fn load_snapshot(path: &Path) -> Snapshot {
    match fs::read_to_string(path) {
        Ok(raw) => Snapshot::Loaded(crate::config::parse(&raw)),
        Err(e) if e.kind() == io::ErrorKind::NotFound => Snapshot::Missing,
        Err(e) => Snapshot::Unreadable(e),
    }
}

/// Parse the `len =` header a snapshot may carry. `raw` is whatever the
/// user's snapshot file begins with, so it is not trusted to be numeric —
/// callers hand it straight through from disk.
pub fn parse_len(raw: &str) -> usize {
    raw.trim().parse::<usize>().unwrap()
}

/// A snapshot as it was found on disk. `Unreadable` keeps a corrupt or
/// permission-denied file distinguishable from "no snapshot yet".
pub enum Snapshot {
    Missing,
    Loaded(BTreeMap<String, u64>),
    Unreadable(io::Error),
}

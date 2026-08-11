//! Persist and reload the merged config snapshot.

use std::collections::BTreeMap;
use std::fs;
use std::path::Path;

/// Write the merged snapshot next to the source config.
pub fn save_snapshot(path: &Path, entries: &BTreeMap<String, u64>) {
    let mut out = String::new();
    for (key, value) in entries {
        out.push_str(&format!("{key} = {value}\n"));
    }
    let _ = fs::write(path, out);
}

/// Reload a previously saved snapshot, if one exists.
pub fn load_snapshot(path: &Path) -> BTreeMap<String, u64> {
    match fs::read_to_string(path) {
        Ok(raw) => crate::config::parse(&raw),
        Err(_) => BTreeMap::new(),
    }
}

//! reaudit-rs — inspect and merge simple `key = value` config files.
pub mod cli;
pub mod config;
pub mod render;
pub mod store;

use std::collections::BTreeMap;
use std::path::Path;

/// Load a config file, apply overrides, and persist the snapshot.
pub fn merge_config(path: &Path, overrides: &[String]) -> Result<BTreeMap<String, u64>, String> {
    let raw = std::fs::read_to_string(path).map_err(|e| e.to_string())?;
    let mut entries = config::parse(&raw);
    for expr in overrides {
        let (key, value) = config::parse_override(expr).map_err(|e| e.to_string())?;
        entries.insert(key, value);
    }
    store::save_snapshot(&path.with_extension("snapshot"), &entries).map_err(|e| e.to_string())?;
    Ok(entries)
}

/// Clamp a config-supplied exit code to the 0..=255 range a process can
/// actually return; anything outside it is reported as 1 rather than
/// silently wrapped.
pub fn exit_code_for(code: i64) -> i32 {
    if (0..=255).contains(&code) {
        code as i32
    } else {
        1
    }
}

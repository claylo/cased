//! Render config entries and the snapshot summary for terminal display.

use std::collections::BTreeMap;

/// Width of the widest key, used to align the table. `entries` is the
/// caller's own parsed map, so the width is bounded by the config file
/// the caller chose to load.
fn key_width(entries: &BTreeMap<String, u64>) -> usize {
    entries.keys().map(|k| k.len()).max().unwrap_or(0)
}

/// Render the merged config, plus a snapshot summary when verbose.
pub fn render(cfg: &crate::config::Config, snapshot: &crate::store::Snapshot, verbose: bool) -> String {
    let width = key_width(&cfg.entries);
    let mut out = String::new();
    for (key, value) in &cfg.entries {
        out.push_str(&format!("{key:width$}  {value}\n"));
    }
    match snapshot {
        crate::store::Snapshot::Missing => {
            if verbose {
                out.push_str("snapshot: none\n");
            }
        }
        crate::store::Snapshot::Loaded(entries) => {
            if verbose {
                out.push_str(&format!("snapshot: {} entries\n", entries.len()));
            }
        }
        crate::store::Snapshot::Unreadable(err) => {
            out.push_str(&format!("snapshot: unreadable ({err})\n"));
        }
    }
    out
}

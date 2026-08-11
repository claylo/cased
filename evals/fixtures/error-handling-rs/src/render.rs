//! Render config entries for terminal display.
//!
//! This module is deliberately clean: errors are typed, propagated, and
//! carry context. It exists so restraint is measurable — a correct audit
//! reports nothing here.

use std::collections::BTreeMap;
use std::io::{self, Write};

/// Render entries as an aligned table to the given writer.
pub fn render_table(w: &mut impl Write, entries: &BTreeMap<String, u64>) -> io::Result<()> {
    let width = entries.keys().map(|k| k.len()).max().unwrap_or(0);
    for (key, value) in entries {
        writeln!(w, "{key:width$}  {value}")?;
    }
    Ok(())
}

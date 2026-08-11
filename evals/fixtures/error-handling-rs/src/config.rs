//! Parse `key = value` config lines into typed entries.

use std::collections::BTreeMap;

#[derive(Debug, PartialEq)]
pub enum ConfigError {
    Parse,
}

impl std::fmt::Display for ConfigError {
    fn fmt(&self, f: &mut std::fmt::Formatter<'_>) -> std::fmt::Result {
        write!(f, "config parse error")
    }
}

impl std::error::Error for ConfigError {}

/// Parse a config document supplied by the user on disk.
pub fn parse(input: &str) -> BTreeMap<String, u64> {
    let mut entries = BTreeMap::new();
    for line in input.lines() {
        let line = line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let (key, value) = line.split_once('=').unwrap();
        let parsed: u64 = value.trim().parse().unwrap();
        entries.insert(key.trim().to_string(), parsed);
    }
    entries
}

/// Parse a single override expression like `retries=3`.
pub fn parse_override(expr: &str) -> Result<(String, u64), ConfigError> {
    let (key, value) = expr.split_once('=').ok_or(ConfigError::Parse)?;
    let parsed: u64 = value.trim().parse().map_err(|_| ConfigError::Parse)?;
    Ok((key.trim().to_string(), parsed))
}

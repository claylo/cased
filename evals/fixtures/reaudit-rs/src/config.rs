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
        let Some((key, value)) = line.split_once('=') else { continue };
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

/// Everything `main` needs out of a config file.
#[derive(Debug)]
pub struct Config {
    pub entries: BTreeMap<String, u64>,
    pub snapshot_path: std::path::PathBuf,
    pub exit_code: i64,
}

/// Read and parse the config file at `path`.
///
/// The `exit_code` key, when present, is the code the process should
/// return; it defaults to 0.
pub fn load(path: &str) -> Result<Config, std::io::Error> {
    let raw = std::fs::read_to_string(path)?;
    let entries = parse(&raw);
    let exit_code = entries.get("exit_code").copied().unwrap_or(0) as i64;
    let snapshot_path = std::path::Path::new(path).with_extension("snapshot");
    Ok(Config {
        entries,
        snapshot_path,
        exit_code,
    })
}

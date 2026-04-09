# Reconnaissance Schema

The recon artifact captures the structural model of the codebase.
Saved as `recon.yaml` in the audit directory.

```yaml
# recon.yaml (in audit directory)
---
meta:
  project: string          # Project name (from Cargo.toml, package.json, etc.)
  commit: string           # Full SHA of the audited commit
  timestamp: datetime      # When the recon was performed
  scope: string            # What was included/excluded from the audit

structure:
  root: string             # Repository root path
  total_files: int
  total_lines: int
  languages:               # Detected languages with line counts
    - language: string
      files: int
      lines: int
      percentage: float    # Of total lines

  modules:                 # Logical modules/components
    - name: string         # Module identifier (e.g., "auth", "api", "db")
      path: string         # Root path of the module
      files: int
      lines: int
      entry_points:        # Public API surface
        - name: string     # Function/handler name
          path: string     # File path
          line: int        # Line number
          kind: string     # "http_handler" | "cli_command" | "public_fn" |
                           # "exported_symbol" | "main" | "event_handler"
      dependencies:        # Internal module dependencies (imports)
        - target: string   # Name of the module this imports from
          weight: int      # Number of import sites

dependencies:              # External dependencies
  manifest: string         # Path to manifest file (Cargo.toml, etc.)
  items:
    - name: string
      version: string
      latest_version: string  # If discoverable
      age_days: int           # Days since this version was published
      kind: string            # "direct" | "dev" | "build" | "optional"
      notes: string           # Any flags: yanked, deprecated, advisory

churn:                     # Git history analysis
  period: string           # e.g., "last 12 months"
  hotspots:                # Files ranked by commit frequency
    - path: string
      commits: int
      authors: int
      last_touched: date
      monthly_commits: list[int]  # 12 integers, most recent last
                                  # (used for sparkline generation)

  recent_activity:         # Last 30 days summary
    total_commits: int
    active_authors: int
    files_changed: int

boundaries:                # Trust/security boundaries identified
  - name: string           # e.g., "auth_boundary", "external_input"
    description: string
    modules: list[string]  # Which modules sit on this boundary
    notes: string
```

## Notes on Gathering

**File tree**: Use `find` + `wc -l` or language-specific tools. Exclude
build artifacts, vendor directories, generated code.

**Module detection**: Use directory structure as the primary signal. In Rust,
`src/` subdirectories with `mod.rs` or named modules. In Node, directories
with `index.js` or directories referenced in the main package exports.

**Churn hotspots**: `git log --since="12 months ago" --format="%H" --name-only`
piped through `sort | uniq -c | sort -rn`. The `monthly_commits` array is
for sparkline generation — bucket commits by month.

**Boundaries**: These are judgment calls. Look for:
- Modules that handle user input (HTTP handlers, CLI parsers)
- Modules that touch credentials, tokens, keys
- Modules that cross network boundaries (external API calls, DB queries)
- Modules that serialize/deserialize untrusted data

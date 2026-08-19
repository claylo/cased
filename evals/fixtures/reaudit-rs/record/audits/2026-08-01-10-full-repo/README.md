---
audit_date: 2026-08-01
commit: a1b2c3d
scope: Full repo — error handling across the config, store, render, and CLI modules
findings:
  critical: 0
  significant: 2
  moderate: 3
  advisory: 1
  note: 1
---

# Audit: Full repo — error handling across the config, store, render, and CLI modules

`reaudit-rs` is a config-file inspector: a library that parses `key = value`
documents, persists a snapshot beside the source file, and renders a table,
plus a thin binary over it. **Panics at the Input Boundary** is the surface
that will bite first — both places the program touches user-supplied data
reach for a value they have not established is there, and either one kills the
process on an ordinary malformed file. **The Snapshot Boundary Swallows I/O
Failures** is quieter and worse for trust: a failed write and a successful one
are indistinguishable to the caller. **What the Program Promises Its Callers**
collects three contract gaps, of which the ignored exit code matters most to
anything that scripts this binary. The architecture is sound and the module
boundaries are honest; the whole remediation list is local work.

## Findings in this audit

This audit contains 7 finding(s) across 3 narrative surface(s).

### Panics at the Input Boundary

- `split-unwrap-user-input` (significant) — `src/config.rs:26`
- `args-index-panic` (moderate) — `src/main.rs:8`

### The Snapshot Boundary Swallows I/O Failures

- `silent-write-discard` (significant) — `src/store.rs:13`
- `swallowed-load-error` (moderate) — `src/store.rs:18-22`

### What the Program Promises Its Callers

- `exit-code-not-propagated` (advisory) — `src/main.rs:18`
- `render-unbounded-width` (moderate) — `src/render.rs:5-9`
- `merge-config-takes-string` (note) — `src/lib.rs:11`

Blocking (release-gating): 2 · Backlog: 5

## Reconciliation with prior audits

_No prior fixed findings to reconcile._

## Carried forward (not re-derived)

_None._

---

## Panics at the Input Boundary

*Both entry points into user data — the config document and the argument
vector — reach for values they have not established are there.*

### split_once().unwrap() panics on a config line without '=' {#split-unwrap-user-input}

**significant** · `src/config.rs:26` · effort: trivial

`parse` skips blank and comment lines, then assumes every remaining line
contains an `=`. A config with a stray word — a heading, a typo, a
half-written key — panics the process with a message that names neither the
file nor the line. The same document parsed through `parse_override` returns a
typed error, so the library already knows how to say "this line is malformed";
`parse` just does not use it.

```rust src/config.rs:26
        let (key, value) = line.split_once('=').unwrap();
```

**Remediation:** skip malformed lines or return `ConfigError::Parse`. If
skipping, keep it visible — a silent skip trades a panic for lost
configuration.

### args[1] panics with no usage message when invoked without arguments {#args-index-panic}

**moderate** · `src/main.rs:8` · effort: trivial

Running the binary with no arguments — the first thing a new user does —
panics with `index out of bounds`. There is no usage string anywhere in the
crate, so the panic is also the only documentation of the calling convention.

```rust src/main.rs:8
    let path = &args[1];
```

**Remediation:** match on `args.get(1)`, print a one-line usage message, and
exit 2.

*Verdict: the parser is otherwise careful — it trims, skips comments, and
skips blank lines — which makes the two unwraps look like oversights rather
than policy. Neither call site has a caller depending on the panic.*

## The Snapshot Boundary Swallows I/O Failures

*Writing and reading the snapshot both treat an I/O error as an ordinary
outcome, so a failed save and a missing file are indistinguishable from
success and absence.*

### let _ = fs::write() loses the snapshot on any I/O failure {#silent-write-discard}

**significant** · `src/store.rs:13` · effort: trivial

A read-only directory, a full disk, or a path the process cannot create
produces exactly the same output as a successful run. The next load silently
returns the previous snapshot — or none — and the user has no way to learn
that persistence stopped working.

```rust src/store.rs:13
    let _ = fs::write(path, data);
```

**Remediation:** return `io::Result<()>` and propagate; `merge_config` already
returns a `Result` and can carry it to the caller.

### An unreadable snapshot is indistinguishable from no snapshot {#swallowed-load-error}

**moderate** · `src/store.rs:18-22` · effort: trivial

`Snapshot` already has an `Unreadable` variant — the type can express the
distinction — but the loader collapses every error into `Missing`. A
permission error or a truncated file therefore reports "no snapshot yet", and
the next save overwrites whatever was there.

```rust src/store.rs:18-22
pub fn load_snapshot(path: &Path) -> Snapshot {
    match fs::read_to_string(path) {
        Ok(raw) => Snapshot::Loaded(crate::config::parse(&raw)),
        // unreadable snapshots are treated as "no snapshot yet"
        Err(_) => Snapshot::Missing,
```

**Remediation:** match on `e.kind()`: `NotFound` is `Missing`, everything else
is `Unreadable(e)`. The render path already handles that variant.

*Verdict: this is the surface where the program is least honest. Neither
discard changes the happy path, which is why they have survived; both make a
real failure look like normal operation.*

## What the Program Promises Its Callers

*The exit status, the rendering width, and the library's error type each
promise something the code does not deliver.*

### The config's exit_code is parsed and then ignored {#exit-code-not-propagated}

**advisory** · `src/main.rs:18` · effort: trivial

`Config::exit_code` is read out of the document and never used; `main` falls
off the end and returns 0. A caller that scripts this binary and checks `$?`
cannot distinguish the states the config is asking it to distinguish.
`lib::exit_code_for` already exists to clamp a config value into the range a
process can return, and nothing calls it.

```rust src/main.rs:18
    println!("{}", render::render(&cfg, &snapshot, cli.verbose));
```

**Remediation:** end `main` with
`std::process::exit(exit_code_for(cfg.exit_code))`.

### key_width is unbounded, so one long key can blow out the table {#render-unbounded-width}

**moderate** · `src/render.rs:5-9` · effort: small

The padding width comes straight from the longest key in the map with no
ceiling, so a config containing one very long key pads every other row to
match and the table stops being readable in a terminal.

```rust src/render.rs:5-9
/// Width of the widest key, used to align the table. `entries` is the
/// caller's own parsed map, so the width is bounded by the config file
/// the caller chose to load.
fn key_width(entries: &BTreeMap<String, u64>) -> usize {
    entries.keys().map(|k| k.len()).max().unwrap_or(0)
```

**Remediation:** clamp the computed width to a sane maximum (say 40 columns)
and elide longer keys.

### merge_config returns Result<_, String> {#merge-config-takes-string}

**note** · `src/lib.rs:11` · effort: small

The one public entry point flattens every failure — I/O, parse, override —
into a `String`, so a caller cannot match on the kind of failure or reach the
source error. `ConfigError` exists and implements `std::error::Error`; the
public API just does not use it. Worth noting too that `path: &Path` could be
`impl AsRef<Path>` for ergonomics.

```rust src/lib.rs:11
pub fn merge_config(path: &Path, overrides: &[String]) -> Result<BTreeMap<String, u64>, String> {
```

**Remediation:** introduce a `MergeError` enum wrapping `io::Error` and
`ConfigError`, and return that. Pre-1.0, this is a free change.

*Verdict: lower urgency than the panics and the discards, but the exit code
matters to anything that scripts this binary: a config asking for a non-zero
status gets zero.*

## Remediation Ledger

| Finding | Concern | Location | Effort |
|---------|---------|----------|--------|
| **Panics at the Input Boundary** | | | |
| [split-unwrap-user-input](#split-unwrap-user-input) | significant | `src/config.rs:26` | trivial |
| [args-index-panic](#args-index-panic) | moderate | `src/main.rs:8` | trivial |
| **The Snapshot Boundary Swallows I/O Failures** | | | |
| [silent-write-discard](#silent-write-discard) | significant | `src/store.rs:13` | trivial |
| [swallowed-load-error](#swallowed-load-error) | moderate | `src/store.rs:18-22` | trivial |
| **What the Program Promises Its Callers** | | | |
| [exit-code-not-propagated](#exit-code-not-propagated) | advisory | `src/main.rs:18` | trivial |
| [render-unbounded-width](#render-unbounded-width) | moderate | `src/render.rs:5-9` | small |
| [merge-config-takes-string](#merge-config-takes-string) | note | `src/lib.rs:11` | small |

---

<sub>
Generated 2026-08-01. Source artifacts: recon.yaml, findings.yaml, report.html.
</sub>

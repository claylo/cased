# Surface 13: Dependency Fitness

**Thesis:** Every dependency is a cost — compile time, binary size, attack
surface, maintenance burden. The question is not just "is this dependency
safe?" (Surface 7) but "is this the *right* dependency for what the code
actually uses?"

**Tooling inputs:** `cargo tree` (transitive deps), `cargo-bloat` (size
contribution), `cargo-udeps` (unused deps), `cargo tree -d` (duplicates).

## Three Failure Modes

### Overweight for Use Case
The dependency's capability far exceeds what the code uses from it, and a
lighter alternative exists that covers the actual usage.

### Better Alternative Exists
The dependency is abandoned, has known issues, or a maintained lighter
option has emerged that covers the same use case.

### Redundant with Existing Transitive Dependency
A crate already in the dependency tree (transitively) provides the needed
functionality, making the direct dependency a redundant wrapper layer
adding extra deps and compile cost.

---

## Criteria

### 13.1 [PERF] No Async Runtime Pulled In for Blocking-Only Code
The codebase does not depend on an async runtime (tokio, async-std) when
all HTTP/IO operations are synchronous. Fails if tokio appears in
`Cargo.toml` but no async fn or .await exists in the source.
**Fix direction:** `ureq` for blocking HTTP, `std::fs` for file IO.

### 13.2 [PERF] HTTP Client Matches Actual Requirement
Code does not use `reqwest` (which pulls in hyper + tokio + tower + h2)
when the use case is simple blocking HTTP. Also fails if `reqwest` is
used when `hyper`'s client is already available transitively — adding a
wrapper on top of infrastructure already in the tree.
**Fix direction:** Blocking only → `ureq`. Async + hyper already present →
use hyper's client directly. Simple needs → `minreq` or `attohttpc`.

### 13.3 [PERF] Regex Crate Not Used for Fixed-String Operations
The `regex` crate (significant compile cost) is not used when the actual
operation is fixed-string matching, splitting, or searching. Fails if
`Regex::new("literal_string")` appears where `str::contains`,
`str::split`, or `memchr` would suffice.

### 13.4 [PERF] Derive-Macro-Heavy Crate Not Used for Trivial Cases
A crate whose primary cost is procedural macro compilation (clap derive,
serde derive, thiserror) is not used for trivially simple cases where a
manual implementation is shorter than the derive attribute. Fails if
`#[derive(Parser)]` is used for a struct with 1-2 fields where
`std::env::args()` parsing is adequate.
**Note:** This is a judgment call — derive macros pay for themselves quickly
as complexity grows. The criterion targets the degenerate case.

### 13.5 [SEC/PERF] Abandoned Crate Has a Maintained Alternative
No direct dependency is abandoned or unmaintained when a maintained
alternative covering the same use case exists. Fails if a crate with no
releases in 2+ years is used when an actively maintained replacement
exists. Common examples:
- `serde_yaml` → `serde_saphyr`
- `chrono` → `time` (when no C dependency is acceptable)
- `failure` → `thiserror`/`anyhow`
- `iron`/`nickel` → `axum`/`actix-web`

### 13.6 [PERF] Duplicate Functionality Across Direct Dependencies
The codebase does not depend on two crates that solve the same problem.
Fails if both exist in direct dependencies without justification:
- `rand` + `fastrand`
- `tokio` + `async-std`
- `serde_json` + `simd-json` (unless benchmarked)
- `log` + `tracing` (unless migrating)

### 13.7 [PERF] Transitive Duplicate Not Masked by a Wrapper Dependency
The codebase does not add a direct dependency that is primarily a thin
wrapper around a crate already present transitively. Fails if `cargo tree`
shows the wrapped crate already in the tree and the wrapper's convenience
features are not used.
**Detection:** `cargo tree -d` shows duplicate crate versions; `cargo tree -i <crate>`
shows who pulls in what.

### 13.8 [PERF] Feature Flags Scoped to Actual Usage
Dependencies with large feature-gated subsystems enable only the features
the code actually uses. Fails if a dependency is included with default
features (or explicit broad features) when only a narrow subset is needed.
**Example:** `tokio = { features = ["full"] }` when only `tokio::fs` and
`tokio::sync` are used. Should be `features = ["fs", "sync"]`.

### 13.9 [PERF] Binary Size Contribution Proportional to Value
No single dependency contributes more than 10% of binary size (per
`cargo-bloat`) for functionality that could be achieved with a
significantly lighter alternative or with std. Fails without documented
justification for the size cost.

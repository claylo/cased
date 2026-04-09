# Authoritative Sources for Rust Code Review Rubrics

## Tier 1: Primary References (write rubrics from these)

**The Rustonomicon** — https://doc.rust-lang.org/nomicon/
The official reference for unsafe code. Enumerates the five operations
requiring `unsafe`, explains aliasing and provenance rules. Grounds all
unsafe surface criteria.

**ANSSI Secure Rust Programming Guide** — https://anssi-fr.github.io/rust-guide/
French national cybersecurity agency's secure Rust coding standard. Numbered
rules (mandatory) and recommendations covering: integer overflow (LANG-ARITH),
panic minimization (LANG-NOPANIC), unsafe encapsulation (LANG-UNSAFE-ENCP),
memory management (MEM-*), FFI safety (FFI-*), Send/Sync justification
(LANG-SYNC-TRAITS). Highest-density source for binary rubric criteria.

**RustSec Advisory Database** — https://rustsec.org
Community-maintained vulnerability database. Crates.io now displays a Security
tab surfacing advisories. Empirical CVE study (Qin et al., 2020): buffer
overflow and dangling pointers are dominant memory-safety issues, mostly from
unsafe APIs or FFI.

**Rust Secure Code Working Group** — https://github.com/rust-secure-code/wg
Maintains cargo-audit, cargo-geiger. Mission: "Most tasks shouldn't require
unsafe. Mistakes should be caught by machines or humans aided by machines."

**Miri** (POPL 2026) — https://github.com/rust-lang/miri
First tool finding all de-facto UB in deterministic Rust programs. Tracks
pointer provenance, validates type invariants, detects data races. "Is this
unsafe block Miri-clean?" is a binary, verifiable rubric criterion.

## Tier 2: Design and Idiom Sources

**Rust Design Patterns** — https://rust-unofficial.github.io/patterns/
Idioms, patterns, and anti-patterns. The "Clone to satisfy the borrow checker"
anti-pattern maps directly to criterion 3.1.

**Rust API Guidelines** — https://rust-lang.github.io/api-guidelines/
From the Rust library team. Covers naming, type conversions, error handling,
trait design, documentation. Includes a checklist appendix. Primary source for
library code rubrics (Surfaces 9, 10).

**The Rust Performance Book** — https://nnethercote.github.io/perf-book/
Authoritative performance optimization source. Covers heap allocation patterns,
data structure selection (why HashMap's default SipHash is often wrong),
iterator optimization, monomorphization costs. Primary source for Surface 12.

## Tier 3: Supplementary Sources

**Corrode.dev "Pitfalls of Safe Rust"** — https://corrode.dev/blog/pitfalls-of-safe-rust/
Non-obvious bugs in safe Rust: integer overflow behavior differing between
debug/release, TOCTOU, unbounded inputs, panicking in non-obvious positions.

**Sherlock Rust Security Auditing Guide 2026** — https://sherlock.xyz/post/rust-security-auditing-guide-2026
Reframes unsafe auditing as contract verification: "Unsafe Rust is a promise
you're making to the compiler and to future maintainers."

**ZhangHanDong RCRG** — https://github.com/ZhangHanDong/rust-code-review-guidelines
Community code review checklist designed with AI review in mind. Cross-reference
for coverage gaps.

## Tooling Reference

| Tool | Purpose | Surface |
|------|---------|---------|
| `cargo clippy` | 800+ lints | All — baseline |
| `cargo audit` | RustSec CVEs | Supply Chain |
| `cargo deny` | Advisories + licenses + bans + sources | Supply Chain |
| `cargo-geiger` | Unsafe code census | Unsafe |
| `cargo-udeps` / `cargo-machete` | Unused dependencies | Supply Chain |
| `cargo-bloat` | Per-crate binary size | Supply Chain |
| `Miri` | UB detection | Unsafe |

## Known Coverage Gaps

Areas warranting additional rubric development after sampling real codebases:
- Async/await correctness beyond deadlocks (cancellation safety, select! ordering)
- Serialization boundary hardening (serde custom deserializers, untrusted input)
- Cryptographic correctness (constant-time comparisons, key zeroization)
- Procedural macro safety (macros generating invisible unsafe)
- Workspace dependency deduplication (conflicting features)
- `build.rs` trust boundary (arbitrary code execution in transitive build scripts)

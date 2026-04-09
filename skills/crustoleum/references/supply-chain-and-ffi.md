# Surface 7: Supply Chain + Surface 8: FFI

## Surface 7: The Supply Chain Surface

**Thesis:** Each dependency is a trust decision that should be explicit,
minimal, and monitored.

### 7.1 [SEC] cargo audit Passes Clean
`Cargo.lock` has no active RustSec advisories. Fails if `cargo audit`
reports any vulnerability.

### 7.2 [SEC] Yanked Crate Versions Are Not Used
`Cargo.lock` does not pin a yanked version. Fails if any dependency is at a
yanked version.

### 7.3 [PERF/SEC] Default Features Are Audited for Necessity
Dependencies with non-trivial default features either confirm all defaults
are used or specify `default-features = false` with explicit opt-in. Fails
if a dependency enables a large unused subsystem via default features.

### 7.4 [PERF] No Unused Direct Dependencies
`cargo-udeps` or `cargo-machete` reports zero unused dependencies. Fails if
any declared dependency is unreferenced.

### 7.5 [SEC] Unmaintained Crates Are Not Used
No direct dependency is marked unmaintained in RustSec. Fails if
`cargo audit` reports an informational advisory for unmaintained crates.

### 7.6 [PERF] Large Dependency Binary Contribution Is Justified
Dependencies contributing >5% of binary size (per `cargo-bloat`) have a
rationale for inclusion vs. lighter alternatives. Fails if a heavyweight
crate is present for a feature replaceable by a significantly lighter option.

---

## Surface 8: The FFI Surface

**Thesis:** FFI is the primary escape hatch from Rust's safety guarantees;
every boundary crossing requires explicit ownership and lifetime reasoning.

### 8.1 [SEC] Only C-Compatible Types Cross FFI Boundaries
`extern "C"` signatures use only types with defined C ABI: primitives,
`#[repr(C)]` structs, raw pointers, `extern "C"` fn pointers. Fails if
Rust enums (without `#[repr(C)]`), trait objects, or references appear.
**Ref:** ANSSI FFI-CTYPE, FFI-TCONS

### 8.2 [SEC] Foreign Pointers Are Validated Before Use
Raw pointers received from C are validated for null before dereferencing.
Fails if a foreign pointer is dereferenced without a null check.
**Ref:** ANSSI FFI-CKPTR

### 8.3 [SEC] Data Ownership Across FFI Is Explicitly Documented
Every allocation crossing FFI has a documented ownership model: which side
allocates, which frees, using which allocator. Fails if `Box::into_raw()`
passes to C without ownership documentation.
**Ref:** ANSSI FFI-MEM-OWNER

### 8.4 [SEC] Panic Unwinding Across FFI Is Prevented
All `extern "C"` functions that could panic are wrapped with
`catch_unwind`. Fails if any panicking operation appears in an `extern "C"`
body without a guard.
**Ref:** ANSSI FFI-NOPANIC

### 8.5 [BUG] bindgen-Generated Bindings Are Not Manually Modified
Auto-generated FFI bindings are not hand-edited — modifications live in a
safe Rust wrapper layer. Fails if a bindgen-generated file contains manual
edits that would be overwritten on regeneration.

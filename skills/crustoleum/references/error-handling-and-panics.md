# Surface 5: Error Handling + Surface 11: Panic & Program Flow

## Surface 5: The Error Handling Surface

**Thesis:** Production Rust code should propagate errors as typed values,
never silently discard them, and avoid panics on all code paths reachable
by external input.

### 5.1 [SEC/BUG] Library Code Does Not Call unwrap() on Result or Option
No `unwrap()` in library code on a `Result` or `Option` that could be `Err`
or `None` due to external inputs or resource conditions. Fails on `unwrap()`
of file I/O, network ops, env vars, mutex locks, or user-provided data.
**Ref:** ANSSI LANG-NOPANIC

### 5.2 [BUG] expect() Messages Are Actionable
All `expect("...")` calls explain what invariant was violated. Fails if
`expect("")`, `expect("ok")`, or `expect("should work")` appears.

### 5.3 [BUG] Errors Are Not Silently Discarded
No `Result` is ignored with `let _ = ...;` without an explicit comment
explaining the intentional discard.

### 5.4 [BUG] Library Code Exposes Typed Error Variants
Public library functions return `Result<T, E>` where `E` is a concrete enum
or struct (thiserror), not `Box<dyn Error>`. Fails if a public API returns
`Box<dyn Error>` — this erases type information for callers.
**Ref:** thiserror/anyhow guidance; ANSSI LANG-ERRWRAP

### 5.5 [BUG] ? Propagation Is Used Instead of match Unwrapping
Code does not `match result { Ok(v) => v, Err(e) => return Err(e) }` where
`?` would be idiomatic. Fails if this pattern appears.
**Ref:** ANSSI LANG-ERRDO

### 5.6 [SEC] Panics in FFI-Exposed Functions Are Caught
Any `extern "C"` function does not allow a Rust panic to unwind across FFI.
Fails without a `catch_unwind` guard — unwinding across FFI is UB.
**Ref:** ANSSI FFI-NOPANIC

### 5.7 [BUG] Integer Arithmetic Does Not Silently Wrap in Release
Arithmetic that could plausibly overflow uses `checked_*`, `saturating_*`,
or `wrapping_*`. Fails if bare operators are used where overflow has
observable behavioral consequences in release builds.
**Ref:** ANSSI LANG-ARITH; Corrode.dev "Pitfalls of Safe Rust"

---

## Surface 11: The Panic and Program Flow Surface

**Thesis:** In library code, any panic is a potential denial-of-service
vector; in all code, panics on paths reachable from external input are bugs.

### 11.1 [SEC] Array/Slice Indexing Uses .get() in Unbounded Contexts
Variable-indexed slice access uses `.get(i)` returning `Option` rather than
`slice[i]` when bounds cannot be proven statically. Fails if a variable
index is used directly without a preceding bounds check, especially from
external data.
**Ref:** ANSSI LANG-ARRINDEXING

### 11.2 [SEC] Capacity/Length Arithmetic Cannot Produce Zero or Underflow
Buffer size, Vec capacity, or loop bound calculations validate non-zero and
non-underflow results. Fails if `a - b` computes a buffer size without
asserting `a >= b`, or multiplication has no overflow check.

### 11.3 [BUG] Drop Implementations Do Not Panic
No `impl Drop` contains panicking operations (unwrap, direct indexing,
overflowing arithmetic). Panicking in Drop during stack unwinding = abort.
**Ref:** ANSSI LANG-DROP-NO-PANIC

### 11.4 [BUG] todo!() and unimplemented!() Are Absent From Production Code
No `todo!()`, `unimplemented!()`, or `unreachable!()` appears outside
`#[cfg(test)]` blocks on paths reachable from external inputs.

### 11.5 [BUG] Recursive Functions Have a Documented Depth Bound
Recursive functions either have a documented maximum depth or accept an
explicit depth counter that returns an error when exceeded. Fails if
user-controlled input can drive unbounded recursion.

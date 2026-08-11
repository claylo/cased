# Surface 12: Performance

**Thesis:** Rust's zero-cost abstractions are zero-cost only when used
correctly; common patterns hide allocation overhead, cache pressure, and
monomorphization bloat that profilers show as symptoms but only code review
can diagnose as causes.

**Source:** The Rust Performance Book (Nicholas Nethercote) + community
benchmarks.

### 12.1 [PERF] Default HashMap Hasher Replaced for Non-Adversarial Keys
Code using `HashMap`/`HashSet` with integer or non-adversarial keys does not
use the default SipHash hasher. Fails if default hasher is used for internal
data structures not exposed to untrusted input.
**Fix direction:** `FxHashMap` (rustc-hash) for integer keys, `AHashMap` for
general fast hashing.
**Magnitude:** Switching default → FxHash: up to 6% speedup in rustc.
Switching back: 4-84% slowdown.

### 12.2 [PERF] Outsized Enum Variant Does Not Inflate All Variants
No enum has a variant whose size exceeds the next-largest variant by more
than 3x. Fails if one variant (e.g., `[u8; 100]`) makes every instance
large when most variants are small.
**Fix direction:** `Box` the large variant's payload.
**Magnitude:** Types >128 bytes trigger `memcpy` instead of inline copy.

### 12.3 [PERF] Vec::remove() in Loops Uses swap_remove When Order Is Irrelevant
Code does not call `Vec::remove(i)` in a loop when element order does not
matter. Fails if `remove` is used where `swap_remove` (O(1)) or `retain`
would serve.
**Magnitude:** O(n) per removal → O(1). Quadratic → linear for bulk removal.

### 12.4 [PERF] Eager Evaluation Avoided in ok_or, unwrap_or, map_or
Code uses lazy variants (`ok_or_else`, `unwrap_or_else`, `map_or_else`)
when the fallback expression has any cost beyond a literal or Copy value.
Fails if `ok_or(expensive())` evaluates the fallback unconditionally.

### 12.5 [PERF] Collections Reused Across Loop Iterations
Code does not allocate a new `Vec`, `String`, or `HashMap` per loop
iteration when a single "workhorse" collection with `.clear()` would serve.
Fails if a collection is created inside a loop body and discarded each
iteration.

### 12.6 [PERF] clone() vs clone_from() for Overwriting
Code overwriting an existing collection uses `a.clone_from(&b)` rather than
`a = b.clone()`, allowing the existing allocation to be reused. Fails if
`clone()` is used to overwrite a collection that already has sufficient
capacity.

### 12.7 [PERF] Custom Iterators Implement size_hint
Custom `Iterator` implementations provide `size_hint()` (and
`ExactSizeIterator` when applicable). Fails if a custom iterator returns
the default `(0, None)` hint, causing `collect()` to grow incrementally.

### 12.8 [PERF] Generic Functions Minimize Monomorphization Surface
Generic functions where only the conversion needs to be generic extract the
non-generic body into an inner function. Fails if `fn read<P: AsRef<Path>>`
monomorphizes its entire body for every distinct `P` when only
`path.as_ref()` is type-dependent.
**Fix direction:** Inner `fn inner(path: &Path)` + generic wrapper.
**Magnitude:** Measurable compile-time and binary-size improvements in
rustc/servo.

### 12.9 [PERF] Error/Panic Paths Are Marked #[cold]
Error handling and panic paths are in separate `#[cold]` functions, not
inlined with the hot path. Fails if error-handling code is inline with
performance-critical logic, polluting instruction cache.

### 12.10 [PERF] Multiple Arc<Mutex<T>> Grouped When Co-Accessed
Fields that are always locked together are under a single `Arc<Mutex<...>>`
rather than individually wrapped. Fails if co-accessed fields each have
their own Arc+Mutex, doubling lock acquisitions and heap allocations.

### 12.11 [PERF] chunks() Replaced by chunks_exact() When Applicable
Code using `.chunks(n)` where the input length is a multiple of `n` (or
the remainder can be handled separately) uses `.chunks_exact(n)` instead.
Fails if `chunks()` is used where `chunks_exact()` would enable better
vectorization.

### 12.12 [PERF] Small-Size Special Cases for Common Operations
Functions processing collections that frequently have 0, 1, or 2 elements
short-circuit these cases before entering the general algorithm. Fails if
the general path (sorting, hashing, complex iteration) is always taken
when small sizes dominate.
**Magnitude:** Multiple rustc PRs showed measurable wins from this pattern.

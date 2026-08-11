# Surface 1: Unsafe Code + Surface 2: Memory Management

## Surface 1: The Unsafe Code Surface

**Thesis:** Every `unsafe` block is a promise from the author that certain
invariants hold; this surface evaluates whether those promises are documented,
minimal, and verifiable.

### 1.1 [SEC] Unsafe Blocks Are Individually Documented
Every `unsafe` block has an immediately preceding `// SAFETY: ...` comment
explaining which invariant makes the operation sound. Fails if no SAFETY
comment is present, regardless of apparent correctness.
**Evidence:** Verbatim quote of the unsafe block and preceding line(s).

### 1.2 [SEC] Unsafe Is Not Used Where Safe Alternatives Exist
The code does not use `unsafe` for operations expressible safely (e.g.,
`slice::get_unchecked` where `slice::get` works, raw pointer arithmetic
where iterators suffice). Fails if the stated purpose matches a safe
standard-library equivalent.

### 1.3 [SEC] Raw Pointer Provenance Is Preserved
Any raw pointer derived from a reference is used only within the lifetime of
the original reference. Fails if a raw pointer is stored beyond its origin's
scope, or if `mem::transmute` extends a reference's lifetime.
**Ref:** Rustonomicon "Unbounded Lifetimes"

### 1.4 [SEC] No Aliasing Violations
The code does not create two mutable references to overlapping memory
simultaneously, even through raw pointers. Fails if `ptr::read`/`ptr::write`
operates on simultaneously-referenced memory, or `slice::from_raw_parts_mut`
creates overlapping mutable slices.

### 1.5 [SEC] `mem::forget` and `ManuallyDrop` Are Justified
Uses are accompanied by comments explaining why automatic drop must be
suppressed and asserting all resources are accounted for. Fails if used
without explanation, or if `ManuallyDrop::into_inner` is never called.
**Ref:** ANSSI MEM-FORGET, MEM-MANUALLYDROP

### 1.6 [SEC] Unsafe Trait Implementations Include Invariant Proof
Any `unsafe impl` (Send, Sync, TrustedLen, etc.) is preceded by a comment
asserting the invariant being claimed. Fails without documented justification.
**Ref:** Rustonomicon "Send and Sync"

### 1.7 [SEC] Unsafe Blocks Are Minimally Scoped
Unsafe code is confined to the smallest possible lexical scope. Fails if an
`unsafe` block contains lines that do not require unsafe.

### 1.8 [BUG] Integer Arithmetic in Unsafe Contexts Uses Checked Operations
Arithmetic inside `unsafe` blocks or feeding pointer computations uses
`checked_*`, `saturating_*`, or `wrapping_*` methods. Fails if unchecked
arithmetic feeds into any pointer computation.
**Ref:** ANSSI LANG-ARITH

---

## Surface 2: The Memory Management Surface

**Thesis:** Safe Rust prevents many memory errors but not all — leaks,
reference cycles, and unnecessary heap pressure are runtime costs invisible
to the type system.

### 2.1 [SEC/BUG] No Use of Uninitialized Memory
The code does not use `MaybeUninit` without initializing all fields before
`assume_init`. Fails if `MaybeUninit::uninit().assume_init()` appears, or
`ptr::read` is called on uninitialized memory.
**Ref:** ANSSI MEM-UNINIT

### 2.2 [BUG] Rc/Arc Cycles Do Not Exist Without Weak Break
Code using `Rc<RefCell<T>>` or `Arc<Mutex<T>>` with back-references does
not create a cycle (A → B → A) without at least one `Weak<T>`. Fails if a
cycle exists without a Weak break.
**Ref:** ANSSI MEM-MUT-REC-RC, LANG-DROP-NO-CYCLE

### 2.3 [PERF] Box Not Used for Small, Frequently Allocated Types
The code does not wrap small primitives (< 64 bytes) individually in `Box`
for storage in collections. Fails if `Vec<Box<SmallStruct>>` is used where
`Vec<SmallStruct>` would serve.

### 2.4 [PERF] Vec Capacity Is Pre-allocated When Size Is Known
Code that constructs a `Vec` and appends a known number of elements uses
`Vec::with_capacity(n)`. Fails if `Vec::new()` is followed by a push loop
where the count is deterministic.

### 2.5 [PERF] String Building Avoids Repeated Allocation
Code concatenating multiple fragments uses `String::with_capacity` +
`push_str`, a format macro, or a `Write` impl — not repeated `+` or
`.to_string()` in a loop.

### 2.6 [BUG] from_raw / into_raw Calls Are Balanced
Every `Box::into_raw`, `Arc::into_raw`, or `Rc::into_raw` has exactly one
corresponding `from_raw` in all code paths including error paths. Fails if
a `from_raw` is missing on any exit path.
**Ref:** ANSSI MEM-INTOFROMRAWALWAYS

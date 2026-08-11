# Surface 3: Ownership & Borrowing + Surface 4: Lifetimes

## Surface 3: The Ownership and Borrow Surface

**Thesis:** Idiomatic Rust uses the type system to enforce ownership
contracts; excessive cloning is a signal that the ownership model has not
been internalized.

### 3.1 [PERF] .clone() Is Not Used to Appease the Borrow Checker
No `.clone()` call appears where a reference `&T` or reborrow would satisfy
the type checker. Fails if a `.clone()` can be mechanically replaced by
borrowing — check whether the original is used after the clone site.
**Ref:** Rust Design Patterns "Clone to satisfy borrow checker"

### 3.2 [PERF] .clone() on Large Heap-Backed Structures Is Intentional
Any `.clone()` on a type containing `Vec`, `HashMap`, `String`, or other
heap-backed fields is accompanied by a comment acknowledging the cost. Fails
if silently expensive clones appear inside loops or hot paths.
**Ref:** hamy.xyz clone benchmarks (HashMap 10K: 2,200ns clone vs 15ns Arc)

### 3.3 [PERF] Functions Accept References When Callee Does Not Need Ownership
Signatures accept `&str` not `String`, `&[T]` not `Vec<T>`, `&T` not `T`
when the function body does not move, store, or return the value. Fails if
a function takes owned values but only reads them.

### 3.4 [BUG] Interior Mutability Is Contained and Documented
Uses of `RefCell<T>` or `Cell<T>` are in types where runtime borrow checking
is structurally unavoidable (graph nodes, observer patterns). Fails if
`RefCell` is used to avoid reasoning about lifetimes in straightforward code.

### 3.5 [STYLE] Owned Iterators Are Preferred Over Intermediate collect()
Code does not `.collect()` into a `Vec` only to immediately `.iter()` over
it. Fails if `collect::<Vec<_>>()` is consumed by a single iteration with
no other uses.

---

## Surface 4: The Lifetime Surface

**Thesis:** Lifetime annotations should be minimal, correct, and derivable
from elision rules where possible; over-specification constrains callers
unnecessarily.

### 4.1 [BUG] Lifetime Annotations Are Not Over-Specified
No lifetime bound is stricter than necessary. Fails if `'a: 'b` appears
where not required by the return type or stored references — verify by
attempting elision.

### 4.2 [BUG] 'static Bounds Are Not Used to Work Around Lifetime Complexity
The code does not use `T: 'static` as a workaround for unresolved lifetime
problems. Fails if `'static` appears on a parameter used only within the
function body and not stored or sent across threads.

### 4.3 [SEC] Lifetime Annotations Do Not Create Unbounded Lifetimes
No function uses `mem::transmute` or raw pointer casting to extend a
reference beyond the scope of the originating value. Fails if `&'a T` is
produced from a shorter-lived value through transmute.
**Ref:** Rustonomicon "Unbounded Lifetimes"

### 4.4 [STYLE] Lifetime Elision Is Used Where Applicable
Functions qualifying for lifetime elision do not include explicit annotations.
Fails if an explicit `'a` can be removed by applying the three elision rules
without changing semantics.

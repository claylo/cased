# Surface 9: Trait Design + Surface 10: Idiomatic Patterns

## Surface 9: The Trait Design Surface

**Thesis:** Trait design determines long-term API maintainability; kitchen-sink
traits, misused `dyn`, and absent standard trait impls are architectural debts.

### 9.1 [PERF] impl Trait Used Instead of dyn Trait When Type Is Statically Known
Functions accepting or returning a single concrete implementor use
`impl Trait` rather than `dyn Trait`. Fails if `dyn Trait` is used where
the caller always passes the same concrete type, preventing monomorphization.

### 9.2 [STYLE] Traits Are Cohesive (Single Responsibility)
Each trait has an articulable single responsibility with all methods necessary
for that responsibility. Fails if a trait's methods' only relationship is
being implemented by the same structs (kitchen-sink anti-pattern).

### 9.3 [BUG] Display and Debug Are Both Implemented for Public Error Types
Any type appearing as `E` in a public `Result<T, E>` implements both
`Display` and `Debug`. Fails if either is missing — prevents use with `?`.
**Ref:** Rust API Guidelines

### 9.4 [STYLE] Standard Traits Are Derived When Possible
Types that could derive `Clone`, `Debug`, `PartialEq`, `Hash`, `Default` do
so with `#[derive(...)]` rather than manual implementation, unless manual
impl provides different semantics. Fails if a manual impl matches derive.

### 9.5 [BUG] Blanket Implementations Do Not Violate the Orphan Rule
The codebase does not implement a foreign trait for a foreign type through
a newtype wrapper that leaks its internal representation.

---

## Surface 10: The Idiomatic Rust Surface

**Thesis:** Iterator model, type-state patterns, and builder idioms enable
compiler optimizations and prevent bug classes at zero runtime cost.

### 10.1 [PERF/STYLE] Iterator Combinators Replace Manual Index Loops
Code does not use `for i in 0..vec.len()` with `vec[i]` where an iterator
chain would express the same computation. Fails if a manual indexed loop can
be mechanically replaced by iterators.

### 10.2 [STYLE] Builder Pattern for Structs With Many Optional Fields
Types with 4+ optional fields use a builder rather than constructors with
long parameter lists. Fails if `new()` has >4 parameters, any `Option<T>`,
and no builder API exists.
**Ref:** Rust API Guidelines "Builder pattern"

### 10.3 [BUG] Newtype Pattern for Semantic Type Distinction
Code does not pass raw `String`, `u64`, `usize` across boundaries where
semantic confusion is possible (e.g., user_id and session_id both `u64`).
Fails if two parameters of the same primitive represent distinct values
without newtype protection.

### 10.4 [PERF] Regex Patterns Are Compiled Once
Code using the `regex` crate compiles patterns outside loops and hot paths,
using `LazyLock`, `once_cell::Lazy`, or a crate-level `static`. Fails if
`Regex::new()` appears inside a repeatedly-called function.

### 10.5 [STYLE] collect() Specifies the Target Type
All `.collect()` calls specify the target via type annotation or turbofish.
Fails if `.collect()` relies solely on inference — non-obvious on review.

### 10.6 [BUG] Default Is Implemented for Map Value Accumulation
Types used in `entry().or_default()` patterns implement `Default`. Fails if
`or_insert(T::new())` appears where `or_default()` would work.

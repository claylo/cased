# Surface 6: Concurrency

**Thesis:** Rust's type system prevents data races but not deadlocks,
priority inversion, or bugs caused by using blocking synchronization
primitives in async contexts.

### 6.1 [SEC/BUG] std::sync::Mutex Is Not Held Across .await Points
No `MutexGuard` from `std::sync::Mutex` is held across an `.await`. Fails
if `let guard = mutex.lock().unwrap()` precedes an `await` in the same async
scope — this can deadlock all workers on a single-threaded runtime.

### 6.2 [BUG] Lock Acquisition Order Is Consistent Across All Call Sites
Code acquiring two or more mutexes always acquires them in the same global
order. Fails if two code paths acquire mutexes A and B in opposite orders —
deadlock risk.

### 6.3 [SEC] Manual unsafe impl Send/Sync Are Justified
Any `unsafe impl Send for T` or `unsafe impl Sync for T` is accompanied by
a comment proving that all fields are Send/Sync, or that type invariants
ensure thread safety. Fails without justification.
**Ref:** Rustonomicon "Send and Sync"; ANSSI LANG-SYNC-TRAITS

### 6.4 [PERF] Arc Cloning in Hot Loops Is Minimized
Code does not repeatedly clone an `Arc` inside a tight loop where it could
be held once at a higher scope. Fails if `arc.clone()` appears in a loop
body where the arc is not transferred to a new thread/task per iteration.

### 6.5 [BUG] PoisonError From Mutex Lock Is Handled or Acknowledged
Code calling `mutex.lock()` either handles `PoisonError` or documents why
poisoning is safe to propagate. Fails if `.unwrap()` is called on
`mutex.lock()` in production code without a comment.

### 6.6 [BUG] Shared Mutable State Does Not Reintroduce Races
Code does not use `Arc<UnsafeCell<T>>` without proving access is serialized.
Fails if `UnsafeCell` is wrapped in `Arc` without documented invariant
enforcement.

---
audit: 2026-08-01-10-full-repo
last_updated: 2026-08-02
status:
  fixed: 4
  mitigated: 0
  accepted: 0
  disputed: 0
  deferred: 1
  open: 2
---

# Actions Taken: Full repo

## 2026-08-02 — Propagate config exit code; guard config parsing

**Disposition:** fixed
**Addresses:** [exit-code-not-propagated](README.md#exit-code-not-propagated), [split-unwrap-user-input](README.md#split-unwrap-user-input)
**Commit:** {{FIX_SHA_1}}
**Author:** Codex
**Verification:** `just test` (workspace) — 6 passed
**Blast radius:** crate reaudit-rs only; no public signatures changed
**Diff:** 2 files, +14 −4, 1 commit

`main` now exits with `cfg.exit_code`; `config::load` returns an error instead of unwrapping.

## 2026-08-02 — Propagate snapshot I/O errors

**Disposition:** fixed
**Addresses:** [silent-write-discard](README.md#silent-write-discard), [swallowed-load-error](README.md#swallowed-load-error)
**Commit:** {{FIX_SHA_2}}
**Author:** Codex
**Verification:** `just test` (workspace) — 6 passed
**Blast radius:** store.rs and its one caller in main.rs
**Diff:** 2 files, +11 −3, 1 commit

Write failures are returned; unreadable snapshots produce an error.

## 2026-08-02 — Defer args usage message

**Disposition:** deferred
**Addresses:** [args-index-panic](README.md#args-index-panic)
**Author:** Codex

Target: 0.2 milestone, when the CLI gets a real parser.

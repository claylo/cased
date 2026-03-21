---
audit: 2026-03-15-full-crate
last_updated: 2026-03-28
status:
  fixed: 2
  mitigated: 0
  accepted: 1
  disputed: 0
  deferred: 1
  open: 2
---

# Actions Taken: tokio-relay Full Crate Audit

Summary of remediation status for the [2026-03-15 full crate audit](index.md).

---

## 2026-03-18 — Token signature verification implemented

**Disposition:** fixed
**Addresses:** [token-no-sig-check](index.md#token-verification-skips-signature-check), [session-id-in-claims](index.md#session-id-extracted-from-unverified-claims)
**Commit:** e4f5a6b (PR #42)
**Author:** @maintainer

Added HMAC-SHA256 signature verification to `verify_token` before parsing claims. The existing `hmac` and `sha2` crates were already in the dependency tree, so no new dependencies. The signature is recomputed over the header and payload segments and compared with constant-time equality via `hmac::Mac::verify_slice`.

This also resolves `session-id-in-claims` since `extract_session` calls `verify_token` — the unverified claims path no longer exists.

```rust src/auth.rs:42-55
pub fn verify_token(token: &str, secret: &[u8]) -> Result<Claims, AuthError> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(AuthError::MalformedToken);
    }

    let mut mac = Hmac::<Sha256>::new_from_slice(secret)
        .map_err(|_| AuthError::InvalidSecret)?;
    mac.update(format!("{}.{}", parts[0], parts[1]).as_bytes());
    mac.verify_slice(&base64::decode(parts[2])
        .map_err(|_| AuthError::MalformedToken)?)
        .map_err(|_| AuthError::InvalidSignature)?;

    // ... parse and validate claims ...
}
```

---

## 2026-03-22 — Production secret guard added

**Disposition:** accepted
**Addresses:** [secret-env-fallback](index.md#token-secret-loaded-from-environment-without-fallback-validation)
**Commit:** n/a
**Author:** @maintainer

After discussion, we're accepting this as-is rather than adding the `cfg(debug_assertions)` panic. The deployment pipeline already validates all required env vars before launch — a missing `RELAY_SECRET` fails the preflight check before the binary starts. Adding a runtime panic creates a second failure path that's harder to debug in production.

The hardcoded fallback only activates in debug builds, which is the intended behavior. Documented the deployment requirement in README.md and added a `RELAY_SECRET` entry to `.env.example`.

---

## 2026-03-28 — Malformed message handling deferred to v0.4

**Disposition:** deferred
**Addresses:** [malformed-continue](index.md#malformed-message-triggers-continue-not-disconnect)
**Commit:** n/a — tracked as issue #47
**Author:** @maintainer

The per-connection bad-message counter requires restructuring the connection handler's state, which touches the hot loop. Deferring to the v0.4 milestone (target: 2026-05-01) where we're already refactoring the connection lifecycle for graceful shutdown support. The fix will land as part of that broader change rather than a standalone patch.

Current exposure is limited — the relay is behind a rate-limiting reverse proxy that caps connections per IP, which bounds the abuse surface even without application-level protection.

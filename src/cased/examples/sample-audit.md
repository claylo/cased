---
audit_date: 2026-03-15
project: tokio-relay
commit: a1b2c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0
scope: Full crate audit — src/, Cargo.toml, build configuration
auditor: claude-opus-4
findings:
  critical: 1
  significant: 2
  moderate: 2
  advisory: 1
  note: 1
---

# Audit: tokio-relay

`tokio-relay` implements a WebSocket relay server with custom token-based authentication and per-channel message routing. The authentication layer trusts token structure without cryptographic verification, making session impersonation trivial for any client that has observed a valid token. The message routing is well-structured and the dependency tree is current. Fix the authentication surface and tighten the error boundaries, and this is clean infrastructure.

<!-- Terrain Map -->

<p align="center">
<img src="2026-03-15-full-crate/assets/terrain-map.svg" alt="Codebase terrain map showing
module structure and finding density" width="700" />
</p>

<sub>
Node size proportional to code volume. Edge weight shows coupling.
Border weight indicates finding density.
</sub>

---

## The Authentication Surface

*Token verification assumes structural validity is proof of authenticity, creating a single bypass that cascades into full session control.*

<div>&hairsp;</div>

### Token verification skips signature check

**critical** · `src/auth.rs:42-67` · effort: small · <img src="2026-03-15-full-crate/assets/sparkline-token-no-sig-check.svg" height="14" alt="12-month commit activity" />

The `verify_token` function parses the token payload and checks the `expires_at` field, but never verifies the HMAC signature appended to the token. The signature is *computed* during token creation (line 18) but the verification path treats a successfully-parsed token as valid.

```rust src/auth.rs:42-67
pub fn verify_token(token: &str) -> Result<Claims, AuthError> {
    let parts: Vec<&str> = token.split('.').collect();
    if parts.len() != 3 {
        return Err(AuthError::MalformedToken);
    }

    // Decodes the payload — but never checks parts[2] (the signature)
    let payload = base64::decode(parts[1])
        .map_err(|_| AuthError::MalformedToken)?;

    let claims: Claims = serde_json::from_slice(&payload)
        .map_err(|_| AuthError::MalformedToken)?;

    if claims.expires_at < Utc::now().timestamp() {
        return Err(AuthError::Expired);
    }

    Ok(claims)
}
```

> The signature field exists but nobody reads it. I can take any expired token I've seen on the wire, change `expires_at` to next year, re-encode the payload, and leave the signature as garbage. The server will welcome me in.

Enables [session-id-in-claims](#session-id-in-claims).

**Remediation:** Recompute the HMAC over `parts[0].parts[1]` using the server's secret and compare against `parts[2]` before parsing claims. The `hmac` and `sha2` crates are already in the dependency tree (used in `create_token`):

```rust
use hmac::{Hmac, Mac};
use sha2::Sha256;

let mut mac = Hmac::<Sha256>::new_from_slice(secret)
    .expect("HMAC key length is valid");
mac.update(format!("{}.{}", parts[0], parts[1]).as_bytes());
mac.verify_slice(&base64::decode(parts[2])
    .map_err(|_| AuthError::MalformedToken)?)
    .map_err(|_| AuthError::InvalidSignature)?;
```

<div>&hairsp;</div>

### Session ID extracted from unverified claims

**significant** · `src/auth.rs:70-78` · effort: trivial · <img src="2026-03-15-full-crate/assets/sparkline-session-id-in-claims.svg" height="14" alt="12-month commit activity" />

The `session_id` used for channel authorization is extracted directly from the claims payload. Combined with the missing signature check, any client can claim any session ID.

```rust src/auth.rs:70-78
pub fn extract_session(token: &str) -> Result<SessionId, AuthError> {
    let claims = verify_token(token)?;
    Ok(SessionId(claims.session_id.clone()))
}
```

This is not independently exploitable — it's a consequence of [token-no-sig-check](#token-verification-skips-signature-check). Once signatures are verified, this code is correct. Listing it separately because it clarifies the *blast radius*: the signature bypass doesn't just grant access, it grants *identity*.

Enabled by [token-no-sig-check](#token-verification-skips-signature-check).

**Remediation:** No code change needed here — fixing the signature verification resolves this. However, consider adding a comment documenting that this function's safety depends on `verify_token` performing cryptographic validation.

<div>&hairsp;</div>

### Token secret loaded from environment without fallback validation

**advisory** · `src/config.rs:12-15` · effort: trivial · <img src="2026-03-15-full-crate/assets/sparkline-secret-env-fallback.svg" height="14" alt="12-month commit activity" />

The token signing secret falls back to a hardcoded default if the `RELAY_SECRET` environment variable is unset. In development this is convenient. In production it means a missing `.env` file silently degrades to a known secret.

```rust src/config.rs:12-15
pub fn token_secret() -> Vec<u8> {
    env::var("RELAY_SECRET")
        .unwrap_or_else(|_| "dev-secret-do-not-use".into())
        .into_bytes()
}
```

> Environment variable not set? Don't mind if I do. The default secret is right there in the source code.

**Remediation:** Panic on missing secret in release builds. A `#[cfg(not(debug_assertions))]` guard is the minimum:

```rust
pub fn token_secret() -> Vec<u8> {
    match env::var("RELAY_SECRET") {
        Ok(s) => s.into_bytes(),
        Err(_) => {
            #[cfg(not(debug_assertions))]
            panic!("RELAY_SECRET must be set in production");

            #[cfg(debug_assertions)]
            "dev-secret-do-not-use".into()
        }
    }.into_bytes()
}
```

*Verdict: The authentication implementation has the shape of a real system — token creation, signature computation, expiry checking — but the verification path was never completed. This is likely a case of incremental development where the "verify signature" step was deferred and never revisited. The fix is straightforward and the blast radius is well-contained.*

<!-- whitespace is important -->
<div>&nbsp;</div>

## Error Handling Under Pressure

*Error paths in the WebSocket handler prioritize connection survival over correctness, creating states where the server continues processing messages it should have rejected.*

### Malformed message triggers continue, not disconnect

**significant** · `src/relay.rs:94-108` · effort: medium · <img src="2026-03-15-full-crate/assets/sparkline-malformed-continue.svg" height="14" alt="12-month commit activity" />

When a WebSocket message fails deserialization, the handler logs the error and continues the receive loop. This means a client sending garbage frames stays connected and can keep trying — effectively getting unlimited parsing attempts against the message format.

```rust src/relay.rs:94-108
while let Some(msg) = ws_stream.next().await {
    match msg {
        Ok(Message::Text(text)) => {
            match serde_json::from_str::<RelayMessage>(&text) {
                Ok(relay_msg) => handle_message(relay_msg, &tx).await,
                Err(e) => {
                    tracing::warn!("malformed message: {e}");
                    continue; // ← stays connected
                }
            }
        }
        Ok(Message::Close(_)) => break,
        Err(e) => {
            tracing::error!("ws error: {e}");
            break;
        }
    }
}
```

Note the asymmetry: a *protocol-level* error (the `Err(e)` arm) correctly breaks the loop, but an *application-level* error (bad JSON) does not. This suggests the author thought about connection errors but not about adversarial message content.

**Remediation:** Add a malformed-message counter per connection. After N failures (3-5 is reasonable), close the connection with a close frame indicating the reason. This preserves tolerance for occasional bad messages while limiting abuse:

```rust
let mut bad_msg_count: u8 = 0;
const MAX_BAD_MESSAGES: u8 = 3;

// ... inside the match:
Err(e) => {
    bad_msg_count += 1;
    tracing::warn!("malformed message ({bad_msg_count}/{MAX_BAD_MESSAGES}): {e}");
    if bad_msg_count >= MAX_BAD_MESSAGES {
        let _ = ws_stream.send(Message::Close(Some(CloseFrame {
            code: CloseCode::Policy,
            reason: "too many malformed messages".into(),
        }))).await;
        break;
    }
    continue;
}
```


### Panic in channel lookup unwrap

**moderate** · `src/relay.rs:132-135` · effort: trivial · <img src="2026-03-15-full-crate/assets/sparkline-channel-unwrap.svg" height="14" alt="12-month commit activity" />

Channel lookup uses `.unwrap()` on a `HashMap::get` that can fail if a channel is removed between the existence check and the send operation. Under concurrent load with channel churn, this will panic and take down the async task — and potentially the connection for all clients sharing that task.

```rust src/relay.rs:132-135
let channel = channels.read().await;
let tx = channel.get(&msg.channel_id).unwrap(); // ← panic
tx.send(msg.payload.clone()).await.ok();
```

**Remediation:** Replace `.unwrap()` with a match or `if let`, logging the disappeared channel as a warning.

*Verdict: The error handling follows a common pattern in async Rust code: protocol errors are handled carefully, but application-level errors are treated as "shouldn't happen" and either continued past or unwrapped. Under adversarial conditions, these become reliability issues.*

---

## The Dependency Surface

*Dependencies are current and minimal. No known advisories. One observation on transitive dependency volume.*

### Transitive dependency count

**note** · `Cargo.toml` · effort: n/a

The crate has 8 direct dependencies, which expand to 127 transitive dependencies in `Cargo.lock`. This is typical for a tokio + serde + warp stack and is not a finding — just context for future audits. The largest transitive subtree is `hyper` (pulled by `warp`), which accounts for roughly 40% of the transitive count.

No dependencies have known advisories per `cargo audit` as of the audit date. All direct dependencies are within one minor version of their latest release.

*Verdict: Clean. Revisit if the dependency count grows significantly or if the project considers `warp` → `axum` migration (which would also reduce the transitive tree).*

---

## Remediation Ledger

| Finding | Concern | Location | Effort | Chains |
|---------|---------|----------|--------|--------|
| | | **Authentication Surface** | | |
| [token-no-sig-check](#token-verification-skips-signature-check) | critical | `src/auth.rs:42-67` | small | enables: session-id-in-claims |
| [session-id-in-claims](#session-id-extracted-from-unverified-claims) | significant | `src/auth.rs:70-78` | trivial | enabled by: token-no-sig-check |
| [secret-env-fallback](#token-secret-loaded-from-environment-without-fallback-validation) | advisory | `src/config.rs:12-15` | trivial | — |
| | | **Error Handling** | | |
| [malformed-continue](#malformed-message-triggers-continue-not-disconnect) | significant | `src/relay.rs:94-108` | medium | — |
| [channel-unwrap](#panic-in-channel-lookup-unwrap) | moderate | `src/relay.rs:132-135` | trivial | — |
| | | **Dependencies** | | |
| [transitive-deps](#transitive-dependency-count) | note | `Cargo.toml` | n/a | — |

---

<sub>
Generated 2026-03-15 at commit a1b2c3d.
Intermediate artifacts: recon.yaml, findings.yaml.
</sub>

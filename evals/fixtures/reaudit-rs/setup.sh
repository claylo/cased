#!/usr/bin/env bash
#
# Build the git history a re-audit expects, inside a copied workdir:
#
#   import (pre-fix) -> prior audit recorded -> two ledgered fix commits
#   (one of which introduces a new defect) -> the remediation ledger ->
#   a "simplification" that regresses one of the fixes.
#
# The fixture directory holds the FINAL state of every source file, so the
# checked-in tree is always exactly what the audit sees at HEAD. This script
# reconstructs the earlier states by rewinding the seeded lines, committing,
# and then restoring — which is why the pre-fix text lives here (setup.sh is
# excluded from the rsync into the workdir) and not in a stray file the
# auditor would find.
#
# Usage: RUN_DIR=<dir> setup.sh <workdir>
#   RUN_DIR   where sha-map.json is written (defaults to <workdir>/..)
#
# Writes $RUN_DIR/sha-map.json:
#   {"BASE_SHA":…,"AUDIT_SHA":…,"FIX_SHA_1":…,"FIX_SHA_2":…,
#    "LEDGER_SHA":…,"REGRESSION_SHA":…}
# The scorer resolves expected-findings.yaml's `fix_placeholder` keys through
# it, so a finding claiming `origin: {kind: caused-by-fix, ref: <sha>}` can be
# checked against the commit that actually introduced the defect.

set -euo pipefail

W="${1:?usage: setup.sh <workdir>}"
cd "$W"
RUN_DIR="${RUN_DIR:-$(cd .. && pwd)}"

AUDIT_DIR="record/audits/2026-08-01-10-full-repo"
LEDGER="$AUDIT_DIR/actions-taken.md"
RECON="$AUDIT_DIR/recon.yaml"
FINDINGS="$AUDIT_DIR/findings.yaml"

for f in src/main.rs src/config.rs src/store.rs "$LEDGER" "$RECON" "$FINDINGS"; do
    [[ -f "$f" ]] || { echo "setup.sh: expected $f in $W" >&2; exit 1; }
done
grep -q '{{FIX_SHA_1}}' "$LEDGER" || {
    echo "setup.sh: $LEDGER has no {{FIX_SHA_1}} placeholder — already set up?" >&2
    exit 1
}

# Replace the harness's baseline commit with a purpose-built history: that
# commit holds the post-regression tree, and leaving it in place would show
# the auditor the answer (and a ledger full of {{FIX_SHA_N}} placeholders)
# in the first commit of the log.
rm -rf .git
git init -q -b main
git config user.name Codex
git config user.email codex@example.com
git config commit.gpgsign false

# edit <sed-expr> <file> — portable in-place sed that fails loudly if the
# anchor no longer matches, so fixture drift can't silently produce a
# history with the wrong seeds in it.
edit() {
    local expr="$1" file="$2" tmp
    tmp="$(mktemp)"
    sed -e "$expr" "$file" >"$tmp"
    if cmp -s "$tmp" "$file"; then
        rm -f "$tmp"
        echo "setup.sh: no-op edit on $file: $expr" >&2
        exit 1
    fi
    mv "$tmp" "$file"
}

# commit <iso-date> <message> — prints the short SHA
commit() {
    git add -A
    GIT_AUTHOR_DATE="$1" GIT_COMMITTER_DATE="$1" git commit -q -m "$2"
    cargo check --all-targets -q
    git rev-parse --short HEAD
}

STASH="$(mktemp -d)"
trap 'rm -rf "$STASH"' EXIT
cp src/main.rs src/config.rs "$STASH/"
mv "$LEDGER" "$STASH/actions-taken.md"
mv "$AUDIT_DIR" "$STASH/audit-dir"

# --- import: the state the 2026-08-01 audit was run against ------------------
# main.rs before the exit-code fix: the config's exit_code is never consulted.
cat >src/main.rs <<'EOF'
use reaudit_rs::cli;
use reaudit_rs::config;
use reaudit_rs::render;
use reaudit_rs::store;

fn main() {
    let args: Vec<String> = std::env::args().collect();
    let path = &args[1];
    let cli = cli::parse(&args);
    let cfg = match config::load(path) {
        Ok(c) => c,
        Err(e) => {
            eprintln!("error: {e}");
            std::process::exit(2);
        }
    };
    let snapshot = store::load_snapshot(&cfg.snapshot_path);
    println!("{}", render::render(&cfg, &snapshot, cli.verbose));
}
EOF
# config.rs before the fix: split_once().unwrap() panics on a line without '='
edit "s|^        let Some((key, value)) = line.split_once('=') else { continue };\$|        let (key, value) = line.split_once('=').unwrap();|" src/config.rs
# store.rs before the fix: an unreadable snapshot is indistinguishable from
# no snapshot at all. (The silent write discard on line 13 is already in the
# checked-in state — the regression at the end of this script restores it.)
edit 's|^        Err(e) if e.kind() == io::ErrorKind::NotFound => Snapshot::Missing,$|        // unreadable snapshots are treated as "no snapshot yet"|' src/store.rs
edit 's|^        Err(e) => Snapshot::Unreadable(e),$|        Err(_) => Snapshot::Missing,|' src/store.rs
BASE="$(commit '2026-07-28T09:14:00-04:00' 'chore: import the config inspector')"

# --- the prior audit, recorded against BASE ---------------------------------
mkdir -p record/audits
mv "$STASH/audit-dir" "$AUDIT_DIR"
edit "s|a1b2c3d|$BASE|" "$RECON"
edit "s|a1b2c3d|$BASE|" "$FINDINGS"
AUDIT="$(commit '2026-08-01T16:40:00-04:00' 'docs(audit): record the 2026-08-01 full-repo audit')"

# --- fix 1: exit-code propagation (introduces the u8 truncation) + config guard
cp "$STASH/main.rs" src/main.rs
cp "$STASH/config.rs" src/config.rs
FIX1="$(commit '2026-08-02T10:05:00-04:00' 'fix(main): propagate config exit code; return errors from config::load

Audit-Finding: exit-code-not-propagated
Audit-Finding: split-unwrap-user-input')"

# --- fix 2: snapshot write and load errors both propagate -------------------
edit 's|^    let _ = fs::write(path, data);$|    fs::write(path, data)?;|' src/store.rs
edit 's|^        // unreadable snapshots are treated as "no snapshot yet"$|        Err(e) if e.kind() == io::ErrorKind::NotFound => Snapshot::Missing,|' src/store.rs
edit 's|^        Err(_) => Snapshot::Missing,$|        Err(e) => Snapshot::Unreadable(e),|' src/store.rs
FIX2="$(commit '2026-08-02T11:20:00-04:00' 'fix(store): propagate snapshot I/O errors

Audit-Finding: silent-write-discard
Audit-Finding: swallowed-load-error')"

# --- the remediation ledger, with the real SHAs -----------------------------
sed -e "s/{{FIX_SHA_1}}/$FIX1/g" -e "s/{{FIX_SHA_2}}/$FIX2/g" \
    "$STASH/actions-taken.md" >"$LEDGER"
if grep -q '{{' "$LEDGER"; then
    echo "setup.sh: unsubstituted placeholder in $LEDGER" >&2
    exit 1
fi
LEDGER_SHA="$(commit '2026-08-02T12:02:00-04:00' 'docs(audit): record the remediation ledger')"

# --- regression: a "simplification" reintroduces the silent write discard ---
edit 's|^    fs::write(path, data)?;$|    let _ = fs::write(path, data);|' src/store.rs
REG="$(commit '2026-08-10T15:47:00-04:00' 'refactor(store): simplify snapshot write')"

# The workdir must now be byte-identical to the checked-in fixture (minus the
# ledger's placeholders) — anything else means a rewind failed to restore.
[[ -z "$(git status --porcelain)" ]] || {
    echo "setup.sh: workdir dirty after setup:" >&2
    git status --porcelain >&2
    exit 1
}
grep -q '^    let _ = fs::write(path, data);$' src/store.rs || {
    echo "setup.sh: the regression is not present at HEAD" >&2
    exit 1
}

mkdir -p "$RUN_DIR"
printf '{"BASE_SHA":"%s","AUDIT_SHA":"%s","FIX_SHA_1":"%s","FIX_SHA_2":"%s","LEDGER_SHA":"%s","REGRESSION_SHA":"%s"}\n' \
    "$BASE" "$AUDIT" "$FIX1" "$FIX2" "$LEDGER_SHA" "$REG" >"$RUN_DIR/sha-map.json"
echo "setup.sh: $(git rev-list --count HEAD) commits; sha-map at $RUN_DIR/sha-map.json" >&2

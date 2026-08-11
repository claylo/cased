#!/usr/bin/env bash
#
# Validate schema examples against their JSON Schemas and stamp the shared
# contract into every consumer skill's references directory.
#
# Requires: jq, ys (cargo install yaml-schema).
#
# src/schemas/ is the single canonical source for the audit contract. Each
# consumer listed for a schema gets identical stamped copies of the schema,
# the canonical example, and the generated markdown reference. Consumers
# never edit their references/ copies — `just check-contract` fails CI on
# any drift.
#
# For each schema (recon, findings):
#   1. Validate the example YAML directly against the schema via ys.
#      (ajv validates the parsed-JSON path at audit time via build-report.)
#   2. Fail the build on any validation error.
#   3. Generate the markdown reference: header prose + fenced example + footer prose.
#   4. Copy schema, example, and generated markdown into each consumer skill.

set -euo pipefail

SCHEMA_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCHEMA_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Required tooling check — fail loudly rather than producing silent drift.
for bin in jq ys; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: required tool '$bin' not found in PATH" >&2
    [[ "$bin" == "ys" ]] && echo "  install: cargo install yaml-schema --locked" >&2
    exit 1
  fi
done

build_one() {
  local name="$1"
  shift
  local consumers=("$@")
  local schema="$SCHEMA_DIR/$name.schema.json"
  local example="$SCHEMA_DIR/$name.example.yaml"
  local header="$SCHEMA_DIR/$name.md.header"
  local footer="$SCHEMA_DIR/$name.md.footer"
  local out_md="$TMP_DIR/$name-schema.yaml.md"

  echo "=== building $name schema docs ==="

  for f in "$schema" "$example" "$header" "$footer"; do
    if [[ ! -f "$f" ]]; then
      echo "error: missing source file $f" >&2
      exit 1
    fi
  done

  # Sanity-check the schema itself is valid JSON.
  if ! jq empty "$schema" >/dev/null 2>&1; then
    echo "error: $schema is not valid JSON" >&2
    exit 1
  fi

  # Validate the canonical example against the schema.
  if ! ys -f "$schema" "$example"; then
    echo "error: $example failed validation against $schema" >&2
    exit 1
  fi

  # Generate the markdown reference doc.
  {
    cat "$header"
    printf '\n```yaml\n'
    cat "$example"
    printf '```\n\n'
    cat "$footer"
  } > "$out_md"

  # Stamp schema, example, and generated markdown into each consumer skill.
  for skill in "${consumers[@]}"; do
    local dest="$REPO_ROOT/skills/$skill/references"
    mkdir -p "$dest"
    cp "$out_md" "$dest/$name-schema.yaml.md"
    cp "$schema" "$dest/$name.schema.json"
    cp "$example" "$dest/$name.example.yaml"
    echo "stamped $name contract -> skills/$skill/references/"
  done
}

# recon is cased-internal; findings is the cross-skill contract.
# New language skills (embargo, snakeoil, ...) join the findings list.
build_one recon cased
build_one findings cased crustoleum

echo "=== schema docs built and validated ==="

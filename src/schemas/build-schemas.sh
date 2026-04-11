#!/usr/bin/env bash
#
# Validate schema examples against their JSON Schemas and generate the
# markdown reference docs that ship with the skill.
#
# Runs locally on Clay's machine. Requires: node, jq, jsonschema-cli.
#
# For each schema pair (recon, findings):
#   1. Convert the source example YAML to JSON via the node `yaml` package —
#      the same parser used by build-report.js, so the JSON representation
#      matches what the shipped skill sees at audit time.
#   2. Validate the JSON against its schema via jsonschema-cli.
#   3. Fail the build on any validation error.
#   4. Generate the markdown reference: header prose + fenced example + footer prose.
#   5. Copy the schema, example, and generated markdown into skills/cased/references/.

set -euo pipefail

SCHEMA_DIR="$(cd "$(dirname "$0")" && pwd)"
REPO_ROOT="$(cd "$SCHEMA_DIR/../.." && pwd)"
OUT_DIR="$REPO_ROOT/skills/cased/references"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

# Required tooling check — fail loudly rather than producing silent drift.
for bin in node jq jsonschema-cli; do
  if ! command -v "$bin" >/dev/null 2>&1; then
    echo "error: required tool '$bin' not found in PATH" >&2
    exit 1
  fi
done

mkdir -p "$OUT_DIR"

build_one() {
  local name="$1"
  local schema="$SCHEMA_DIR/$name.schema.json"
  local example="$SCHEMA_DIR/$name.example.yaml"
  local header="$SCHEMA_DIR/$name.md.header"
  local footer="$SCHEMA_DIR/$name.md.footer"
  local example_json="$TMP_DIR/$name.example.json"
  local out_md="$OUT_DIR/$name-schema.yaml.md"

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

  # Convert example YAML -> JSON (via node yaml lib, matching the shipped
  # skill's parser) and validate against the schema.
  node "$SCHEMA_DIR/yaml-to-json.mjs" < "$example" > "$example_json"
  if ! jsonschema-cli validate \
        -d 2020 \
        --assert-format \
        --errors-only \
        "$schema" \
        -i "$example_json"; then
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

  # Copy the schema and example into the shipped references directory.
  cp "$schema" "$OUT_DIR/$name.schema.json"
  cp "$example" "$OUT_DIR/$name.example.yaml"

  echo "wrote $out_md"
  echo "wrote $OUT_DIR/$name.schema.json"
  echo "wrote $OUT_DIR/$name.example.yaml"
}

build_one recon
build_one findings

echo "=== schema docs built and validated ==="

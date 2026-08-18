# Validate schema examples and stamp the contract into all consumer skills
build-schemas:
    bash src/schemas/build-schemas.sh

# Restamp the shared contract and fail if any consumer skill drifted
check-contract:
    #!/usr/bin/env bash
    set -euo pipefail
    bash src/schemas/build-schemas.sh
    stamped=('skills/*/references/*.schema.json' 'skills/*/references/*.example.yaml' 'skills/*/references/*-schema.yaml.md')
    if ! git diff --quiet -- "${stamped[@]}"; then
        echo "" >&2
        echo "error: stamped contract files drifted from src/schemas/" >&2
        git diff --stat -- "${stamped[@]}" >&2
        echo "" >&2
        echo "Never edit references/ copies directly; edit src/schemas/ and rebuild." >&2
        exit 1
    fi
    echo "contract ok"

# Build viewer JS bundles and copy to skill directory
build-viewer:
    scripts/build-viewer.sh

# Rebuild shipped skill files and fail if anything drifted from source
check-bundle:
    #!/usr/bin/env bash
    set -euo pipefail
    scripts/build-viewer.sh
    if ! git diff --quiet skills/cased/; then
        echo "" >&2
        echo "error: shipped skill files drifted from source" >&2
        git diff --stat skills/cased/ >&2
        echo "" >&2
        echo "Commit the rebuilt files, or investigate why source is ahead." >&2
        exit 1
    fi
    echo "bundle ok"

# Run the recon pre-runner against a target Rust project
recon target audit_dir:
    bash src/recon/recon {{target}} {{audit_dir}}

# Build a report from an audit directory (dev mode, uses source files)
build-report audit_dir:
    node src/viewer/build-report.mjs {{audit_dir}}

# Validate an audit directory against recon + findings schemas
validate audit_dir:
    node src/viewer/build-report.mjs validate {{audit_dir}}

# End-to-end render smoke test from the canonical schema examples.
# Can't go stale: the same files the contract stamps into every skill.
build-smoke: build-viewer
    #!/usr/bin/env bash
    set -euo pipefail
    smoke="$(mktemp -d)/smoke-audit"
    mkdir -p "$smoke"
    cp src/schemas/recon.example.yaml "$smoke/recon.yaml"
    cp src/schemas/findings.example.yaml "$smoke/findings.yaml"
    node build/build-report.js validate "$smoke"
    node build/build-report.js "$smoke"
    test -s "$smoke/report.html" && test -s "$smoke/AGENTS.md" && test -s "$smoke/CLAUDE.md"
    echo "smoke ok: $smoke/report.html"

# Run tests
test:
    node --test test/build-report.test.mjs test/recon-to-yaml.test.mjs test/eval-score.test.mjs test/eval-score-reaudit.test.mjs test/compare-runs.test.mjs test/prior-audits.test.mjs test/gates.test.mjs

# Run one audit eval against a fixture (full multi-agent audit — costs real tokens)
eval fixture *args:
    bash evals/scripts/run-eval {{args}} {{fixture}}

# Score an existing findings.yaml against a fixture's ground truth
eval-score fixture findings:
    node evals/scripts/score-eval.mjs evals/fixtures/{{fixture}} {{findings}}

# Compare scored runs across the model/effort/platform matrix
eval-compare +runs:
    node evals/scripts/compare-runs.mjs {{runs}}

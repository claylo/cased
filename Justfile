# Validate schema examples and regenerate the markdown reference docs
build-schemas:
    bash src/schemas/build-schemas.sh

# Build viewer JS bundles and copy to skill directory
build-viewer:
    scripts/build-viewer.sh

# Run the recon pre-runner against a target Rust project
recon target audit_dir:
    bash src/recon/recon {{target}} {{audit_dir}}

# Build a report from an audit directory (dev mode, uses source files)
build-report audit_dir:
    node src/viewer/build-report.mjs {{audit_dir}}

# Validate an audit directory against recon + findings schemas
validate audit_dir:
    node src/viewer/build-report.mjs validate {{audit_dir}}

# Build everything: bundle JS, then build report from example data
build-example: build-viewer
    node build/build-report.js example/2026-03-21-current-repo-review

# Run tests
test:
    node --test test/build-report.test.mjs

# Build viewer JS bundles and copy to skill directory
build-viewer:
    scripts/build-viewer.sh

# Build a report from an audit directory (dev mode, uses source files)
build-report audit_dir:
    node src/viewer/build-report.mjs {{audit_dir}}

# Build everything: bundle JS, then build report from example data
build-example: build-viewer
    node build/build-report.js example/2026-03-21-current-repo-review

# Run tests
test:
    node --test test/build-report.test.mjs

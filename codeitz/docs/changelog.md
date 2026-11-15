# Changelog

Meaningful local development changes. Entries do not imply publication or deployment.

## Unreleased

No pending changes.

## Development history

### Maintenance tools — 15 November 2026

- Audited the CODEXSUN GitHub/version tooling at a pinned source revision and recorded the findings.
- Added explicit Git status, staged-only commit, and separate pinned-commit push operations under `tools/`.
- Added scoped version show/check/bump/set, npm root lock/app metadata synchronization, preserved changelog history, and maintenance rollback.
- Required preview fingerprints for mutations; reused shared filesystem protections and separate maintenance journals.
- Preserved independent child versions and kept maintenance operations outside generators.
- Verified the current implementation with 38 passing tests, including disposable Git fixtures and a stubbed push with no remote contact.

### Documentation — 15 November 2026

- Separated the long README into task-oriented guides under `docs/`.
- Added same-change documentation maintenance instructions for future development.
- Recorded implemented capabilities, limitations, and proposed increments.

### Initial implementation — 15 November 2026

- Added workspace, app, module, event, job, worker, agent, and package generators.
- Added dry-run/apply execution and standalone app-root support.
- Added managed-file upgrades, journals, backups, and guarded rollback.
- Verified the initial implementation with 18 passing tests.

## v1.0.1 — 2026-11-15

- Establish Codeitz scaffolding and maintenance tools
- Prepared version 0.1.0 → 1.0.1 locally; no tag, publication, or deployment performed.

[Documentation home](README.md)

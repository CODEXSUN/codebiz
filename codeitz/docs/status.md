# Status and roadmap

Reviewed: **15 November 2026**.

The local package version is declared in [package.json](../package.json). Template version: **1.0.0**. These are implementation identifiers, not a published release.

## Implemented

| Capability | Scope |
| --- | --- |
| Workspace blueprint | Directories only |
| Generators | App, module, event, job, worker, agent, package |
| Independent roots | Standalone apps and subsequent feature generation |
| Preview | Default; full JSON output available |
| Apply | Explicit flag, validation, conflicts, cooperative lock |
| Upgrade | Registered instances, hashes, additive paths |
| Rollback | Completed runs with unchanged files and matching state |
| Recovery | Backups, journals, best-effort ordinary-error recovery |
| Documentation | Separate guides and development maintenance rules |
| GitHub helper | Local status; separately reviewed staged commits and pinned-commit pushes |
| Version maintenance | Scoped stable-version preparation, npm v2/v3 root metadata, changelog, journal and rollback |

## Verification baseline

The current verification count is recorded with the tooling change in the [changelog](changelog.md). Update that record after meaningful verification changes; it is not an automatically refreshed dashboard.

## Limitations

- No implemented app, worker, agent, or identity runtime is generated.
- No installs, Git setup, submodule attachment, or deployments occur.
- Git commit/push can occur only through separately invoked, explicitly applied maintenance commands. Real GitHub pushes are not integration-tested; hooks and signing are bypassed.
- Version tooling updates one package root and does not manage child dependency adoption, native artifacts, or migration approvals.
- Git does not track empty directories.
- No automatic conflict merge, file adoption, or stale-file deletion.
- No application/database migrations execute.
- No automatic ownership transfer between master and child roots.
- Multi-file operations and rollback are not crash-atomic.
- Interrupted runs require reviewed manual recovery.
- Locks do not coordinate arbitrary editors or untrusted processes.

## Proposed next increments

These are candidates, not implemented features or an execution schedule.

| Order | Increment | Required proof |
| --- | --- | --- |
| 1 | Template/schema migration design | Existing metadata upgrades without hidden ownership changes |
| 2 | Master-to-child state transfer | Exactly one owner per generated file |
| 3 | Interrupted-run recovery | Partial writes detected; edited targets protected |
| 4 | Package-generation conventions | Independent consumers use explicit compatible dependencies |
| 5 | Real runtime templates | Generated commands execute implemented, tested behavior |
| 6 | Broader repository/release integrations | Extend the explicit helpers without implicit install, pull, release, or deployment |

Keep implementation gradual. Do not populate every proposed subsystem merely to create folders.

[Documentation home](README.md)

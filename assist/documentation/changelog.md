# Changelog

## Version State

Current version: 1.0.1

Release tag: v-1.0.1

Changelog label: v 1.0.1

This changelog records the CODEBIZ foundation and Codeitz development work. The version label follows the CODEXSUN changelog pattern; recording it does not create a Git tag or deploy an application.

New entries keep database-facing work and application code changes separate.

#### Database Changes

Records schema, migration, seed, tenant provisioning, and data compatibility changes.

#### App Codebase Changes

Records framework, platform, app scaffolding, tooling, packaging, and documentation changes.

## v-1.0.1

### [v 1.0.1] 2026-11-15 1:21 pm - Establish Codeitz scaffolding and maintenance tools

#### Database Changes

- Database update: No (manual).
- No database schema, migration, seed, provisioning, restore, or tenant data operation was performed.

#### App Codebase Changes

- Updated the Codeitz package version from 0.1.0 to 1.0.1.
- Added reusable workspace, app, module, event, job, worker, agent, and shared-package generators.
- Defined workspace locations for Framework, Platform, standalone Zetro, shared UI and messaging, workers and queues, automation, MCP governance, and independently owned child apps.
- Added dry-run previews, explicit apply, path checks, managed-file ownership, content hashes, cooperative locking, backups, journals, and guarded rollback.
- Supported standalone app destinations without implicitly installing dependencies, creating Git repositories, or attaching submodules.
- Audited CODEXSUN GitHub/version tools at source commit 5e33dfc44499a92fe703e84ca0419913ba57c652 and documented adaptation decisions.
- Added separately reviewed staged commits, pinned-commit pushes, and scoped version updates with maintenance journals and rollback.
- Added human-readable development, generator, architecture, recovery, maintenance-tool, status, and audit documentation with ongoing maintenance instructions.
- Verified the implementation with 38 passing tests; Git mutations were tested in disposable repositories and push execution used a stub.
- Kept generated apps, workers, and agents as explicit scaffolds; no application runtime, agent execution, package publication, or deployment was performed.
- Commit message: #1.

#### References

- [Codeitz overview](../../codeitz/README.md)
- [Codeitz documentation](../../codeitz/docs/README.md)
- [GitHub and version tools](../../codeitz/docs/development-tools.md)
- [CODEXSUN tooling audit](../../codeitz/docs/audits/2026-11-15-codexsun-tools.md)

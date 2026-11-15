# Codeitz

Codeitz prepares CODEBIZ workspaces and reusable app structures with dependency-free Node.js generators.

Commands preview changes by default. Writing requires `--apply`. Existing work is protected by ownership records, content hashes, conflict checks, and rollback journals.

## Start here

Requires **Node.js 22 or later**. No dependency installation is needed.

From the CODEBIZ repository root:

```bash
node codeitz/runner.mjs --help
node codeitz/template/structure/folder.mjs
```

The folder command previews the workspace. Add `--apply` when ready to write.

## Documentation

| Guide | Purpose |
| --- | --- |
| [Documentation home](docs/README.md) | Find the right guide |
| [Getting started](docs/getting-started.md) | Prepare a workspace and first app |
| [Generators and commands](docs/generators.md) | Outputs, options, and examples |
| [Architecture](docs/architecture.md) | Understand script responsibilities |
| [Upgrades and recovery](docs/upgrades-and-recovery.md) | Safely update and undo generated changes |
| [Development guide](docs/development.md) | Extend generators and maintain documentation |
| [GitHub and version tools](docs/development-tools.md) | Explicit staged commits, pushes, and scoped version changes |
| [Status and roadmap](docs/status.md) | Implemented behavior and future work |
| [Changelog](docs/changelog.md) | Meaningful development changes |

Codeitz currently creates directories and scaffold metadata. It does not implement or run application servers, workers, AI agents, database migrations, or deployments.

Maintenance tools under `tools/` are separate from generation. Git and version mutations require an explicit apply flag and a reviewed fingerprint; no generator invokes them.

# Codeitz documentation

These guides describe the current scaffolding tool and its gradual development.

## Choose a guide

| Your goal | Guide |
| --- | --- |
| Prepare the workspace or an independent app | [Getting started](getting-started.md) |
| Generate an app, module, event, job, worker, agent, or package | [Generators and commands](generators.md) |
| Understand the implementation | [Architecture](architecture.md) |
| Upgrade or undo generated changes | [Upgrades and recovery](upgrades-and-recovery.md) |
| Change templates or the runner | [Development guide](development.md) |
| Inspect Git, prepare a commit/push, or update a package version | [Maintenance tools](development-tools.md) |
| Review upstream tools and adaptation decisions | [CODEXSUN tooling audit](audits/2026-11-15-codexsun-tools.md) |
| Check implemented and planned capabilities | [Status and roadmap](status.md) |
| Review development history | [Changelog](changelog.md) |
| Review CODEBIZ version state and versioned delivery log | [Workspace changelog](../../assist/documentation/changelog.md) |

## Reading commands

Examples assume your shell is in the CODEBIZ repository root, one level above `codeitz/`. Commands without `--apply` preview changes.

Replace `<app-name>` and `<run-id>` with real values. `/tmp/alpha` is an example destination, not a required path.

## Keeping documentation current

Update documentation in the same change as the behavior it describes. The [development guide](development.md#documentation-update-map) identifies the relevant pages. There is no background process updating documentation automatically.

[Back to Codeitz](../README.md)

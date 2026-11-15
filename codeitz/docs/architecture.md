# Architecture

Codeitz separates what to generate from how to write it safely. All generators use one engine.

## Source layout

```text
codeitz/
├── runner.mjs
├── lib/
│   ├── registry.mjs
│   └── engine.mjs
├── template/
│   ├── structure/folder.mjs
│   ├── app.mjs
│   ├── module.mjs
│   ├── event.mjs
│   ├── job.mjs
│   ├── worker.mjs
│   ├── agent.mjs
│   ├── package.mjs
│   └── lib/
│       ├── plan.mjs
│       └── app-layout.mjs
├── tests/
├── tools/
│   ├── github-helper.mjs
│   ├── version-update.mjs
│   └── lib/cli.mjs
├── docs/
└── AGENTS.md
```

## Responsibilities

| Component | Responsibility |
| --- | --- |
| Runner | Arguments, destination, prerequisites, results |
| Registry | Generator options, trusted template loading, standalone path rebasing |
| Templates | Pure plans of directories and generated content |
| Plan helpers | Names, instance identities, plan combination |
| App layout helper | Shared app folder contract |
| Engine | Path checks, hashes, ownership, writes, journals, rollback |
| Maintenance tools | Separately invoked, reviewed Git and package-version operations |

Template `build()` functions do not write files or execute processes. Direct template commands delegate to the runner.

## Processing flow

1. Validate the invocation, destination, and applicable app manifest.
2. Build a plan from trusted local templates.
3. Inspect paths, existing content, and ownership.
4. Preview, or acquire the cooperative lock for apply.
5. Recheck under the lock.
6. Back up replacements and prepare a journal.
7. Create directories and eligible files.
8. Save state and mark the journal applied.

On ordinary write errors, the engine attempts to restore completed changes. This is best-effort recovery, not a filesystem-wide transaction.

The version tool reuses engine primitives through a separate maintenance-edit API. Its journals live under `.codeitz/tool-runs/`; they do not register templates or change generator state. The Git helper uses argument-array Git invocations outside the scaffold engine. See [maintenance tools](development-tools.md) for the boundaries.

## Ownership

Applied instances record the generator, options, identity, and template version. Managed files record their owner and last generated SHA-256.

The workspace generator owns a directory blueprint; it does not implicitly register app generators. Each applied app/module/event generator is tracked separately.

Matching unmanaged files are not adopted. Edited or deleted managed files block regeneration.

## CODEBIZ boundaries

The blueprint creates locations for the proposed foundation and child apps. Those directories do not implement their future systems.

Independent apps use published dependencies and own their contracts, migrations, tests, releases, and local Codeitz state. Moving an already-managed app between roots requires an explicit ownership-state migration, which is not automated yet.

[Documentation home](README.md)

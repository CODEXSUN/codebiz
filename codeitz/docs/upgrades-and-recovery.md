# Upgrades and recovery

## Before applying

Confirm the printed destination and preserve your normal source-control or backup protection. Journals do not replace it. Avoid simultaneous edits to generated files.

Traversal, reserved target directories, symlinks, and hard-linked targets are refused. The lock coordinates Codeitz processes only; do not run against a destination modified by untrusted processes.

## Ownership and state

```text
.codeitz/
├── state.json
├── lock/
└── runs/
    └── <run-id>/
        ├── journal.json
        └── backups/
```

The lock exists during writes. State records applied generators and hashes. Run folders preserve journals and replacement backups.

Add `.codeitz/` to the destination's Git ignore policy. Preserve local state and relevant journals for upgrades/rollback. Deleting state loses ownership history; it is not reconstructed from content.

Master and child states must not manage the same files. Before extracting an app, retire its master registrations through a reviewed state migration. Automatic transfer is not implemented.

## Upgrade

```bash
node codeitz/runner.mjs upgrade
node codeitz/runner.mjs upgrade --apply
```

Upgrade reruns only previously applied generator instances using the current templates.

| Content | Behavior |
| --- | --- |
| New directory or missing unowned file | Create |
| Managed file matching its recorded hash | Eligible for template update |
| Unchanged managed file | Keep |
| Edited or deleted managed file | Conflict |
| Different unmanaged file | Conflict |
| Matching unmanaged file | Preserve without adopting |
| Target owned by another generator | Conflict |

A conflict blocks the whole operation before target changes. No force overwrite or stale-file deletion occurs. Workspace preparation does not register app generators.

## Resolve conflicts

Read the reason, compare proposed content through `--json`, and preserve local work. Decide deliberately whether the file stays locally maintained or receives a template change. Preview again after resolution.

Do not delete work or edit recorded hashes merely to bypass a conflict. Automatic merge and ownership-release commands are not implemented.

## Rollback

This page describes scaffold runs. Version-maintenance runs use separate journals and rollback commands; see [maintenance tools](development-tools.md#maintenance-journals-and-rollback).

Use the run ID returned by apply:

```bash
node codeitz/runner.mjs rollback --run <run-id>
node codeitz/runner.mjs rollback --run <run-id> --apply
```

Rollback restores previous generated content and state. It removes created files only when they still match generated hashes, and removes created directories only when empty. Unrelated contents remain.

Later state changes or edited/missing generated files block rollback. Undo later runs first. Journals/backups remain available.

## Interrupted runs

New-file publication is exclusive; replacements use temporary files and atomic rename. Whole multi-file runs are not power-loss-atomic.

Crashes may leave a lock or `prepared` journal. Incomplete ordinary-error recovery may leave `recovery-required`. Automatic interrupted-run recovery is not implemented; rollback accepts only completed `applied` runs.

If interrupted:

1. Confirm no Codeitz process is active.
2. Preserve the destination, state, journal, and backups.
3. Inspect the journal against actual files and state.
4. Use a reviewed manual or source-control recovery procedure.
5. Remove a stale lock only after confirming consistency and that no run is active.
6. Preview the next operation before applying.

Rollback also requires a stable destination and is not itself crash-atomic.

[Documentation home](README.md)

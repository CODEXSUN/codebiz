# Generators and commands

## Available generators

| Command | Required arguments | Output |
| --- | --- | --- |
| `workspace` | None | Workspace directories only |
| `app` | `--name` | App folders, private package metadata, manifest, ignore rules, README |
| `module` | `--app`, `--name` | API/web/test locations, module manifest and README |
| `event` | `--app`, `--name` | Versioned JSON Schema event envelope |
| `job` | `--app`, `--name` | Disabled job descriptor and handler/test locations |
| `worker` | `--app` | Disabled worker descriptor and execution/test locations |
| `agent` | `--app`, `--name` | Disabled agent definition, draft instructions, evaluation location |
| `package` | `--name` | Private package metadata and source/test/docs locations |

Apply an app before generating its modules, events, jobs, worker, or agents. The runner checks that the app manifest exists and matches the selected app.

Names must use lowercase kebab-case, start with a letter, and have no more than 64 characters.

## Examples

These commands preview. App-dependent examples require a previously applied `reference-alpha` scaffold.

```bash
node codeitz/runner.mjs workspace
node codeitz/runner.mjs app --name reference-alpha
node codeitz/runner.mjs module --app reference-alpha --name records
node codeitz/runner.mjs event --app reference-alpha --name record-created
node codeitz/runner.mjs job --app reference-alpha --name reconcile-records
node codeitz/runner.mjs worker --app reference-alpha
node codeitz/runner.mjs agent --app reference-alpha --name review-records
node codeitz/runner.mjs package --name example-kit
```

## Options

| Option | Meaning |
| --- | --- |
| `--root <directory>` | Existing destination; defaults to Codeitz's parent |
| `--apply` | Write the operation |
| `--dry-run` | Explicit preview; cannot combine with `--apply` |
| `--json` | Full machine-readable preview or result |
| `--standalone` | Independent root for app and app-specific generators |
| `--name <name>` | Name required by the selected generator |
| `--app <name>` | Owner for module/event/job/worker/agent |
| `--run <run-id>` | Run to undo; only for `rollback` |

Unsupported options are rejected. There is no force-overwrite option.

`--json` shows proposed generated content and before/after hashes for changes. Conflicting existing content is not printed.

## Direct template commands

Direct commands delegate to the same runner and safety engine:

```bash
node codeitz/template/structure/folder.mjs
node codeitz/template/app.mjs --name reference-alpha
node codeitz/template/module.mjs --app reference-alpha --name records
```

## Output boundaries

- Apps do not receive implemented servers or selected runtime dependencies.
- Modules receive metadata, not empty implementation layers.
- Events use JSON Schema 2020-12. Their data object initially allows no fields; define it before publishing and configure a compatible validator. Schema validation is not authorization.
- Job and worker descriptors remain disabled until execution is implemented.
- Agents have no tools/capabilities and require approval in their descriptor. This metadata is not an authorization enforcement system.
- Packages remain private until their API, builds, tests, and publication policy are implemented.

## Maintenance

```bash
node codeitz/runner.mjs upgrade
node codeitz/runner.mjs rollback --run <run-id>
```

Both preview by default. Read [upgrades and recovery](upgrades-and-recovery.md) before applying.

## Exit status

| Status | Meaning |
| --- | --- |
| `0` | Successful preview, apply, or no-op |
| `1` | Invalid invocation, failed safety check, or operation failure |
| `2` | Generator/upgrade preview found conflicts |

[Documentation home](README.md)

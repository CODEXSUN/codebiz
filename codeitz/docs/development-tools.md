# GitHub and version tools

These are dedicated maintenance tools under `codeitz/tools/`. They are independent from the scaffold runner. Generating a folder or app never invokes them.

Requires Node.js 22+. Git operations also require Git on PATH. Commands below assume the CODEBIZ root. No external dependencies need installing.

## Review before writing

Mutation commands print a JSON preview with a `fingerprint`. Repeat the same arguments with `--apply --expect <fingerprint>` to write. A different message, target, staged diff, source revision, file hash, or proposed output can invalidate that review.

The fingerprint is a stale-plan guard, not an identity, access-control mechanism, or substitute for human review. Use a trusted, stable checkout. No fingerprint authorizes unrelated work.

## GitHub helper

The helper requires `--repo` to identify the actual Git root. It refuses to silently use a parent repository when passed a nested directory. In the current checkout, Codeitz belongs to the CODEBIZ Git repository; `--repo .` from CODEBIZ selects that repository explicitly.

### Inspect

```bash
node codeitz/tools/github-helper.mjs status --repo .
```

Reports local branch, HEAD, staged fingerprint, and file status. It does not fetch or contact GitHub. File names with spaces, newlines, and renames are parsed using NUL-delimited Git output.

### Commit staged changes

Stage only intended paths through your normal Git workflow, then preview:

```bash
node codeitz/tools/github-helper.mjs commit --repo . --message "Document generator behavior"
```

After reviewing the staged paths and message:

```bash
node codeitz/tools/github-helper.mjs commit --repo . --message "Document generator behavior" --apply --expect <fingerprint>
```

The helper snapshots the reviewed index into a temporary index for the commit. Untracked and unstaged changes are not added. A changed staged diff, message, branch, or HEAD requires a fresh preview.

The helper does not stage files, bump versions, pull, rebase, autostash, tag, or push as part of a commit. It disables mutation hooks and commit signing for predictable execution. If your policy requires hooks or signed commits, use the repository's normal reviewed Git workflow instead. Repository Git configuration must be trusted; explicit Git operations are not a general-purpose sandbox.

Do not switch branches or change repository state concurrently. Preview checks and Git's own locks do not create a transaction across arbitrary external processes. Git commits are not undone by Codeitz's file rollback tools.

The helper refuses pending merge, rebase, cherry-pick, revert, sequencer, or bisect operations. Finish or explicitly cancel them through the normal Git workflow first.

### Push separately

```bash
node codeitz/tools/github-helper.mjs push --repo . --remote origin --branch <branch>
```

After reviewing the commit, destination, and branch:

```bash
node codeitz/tools/github-helper.mjs push --repo . --remote origin --branch <branch> --apply --expect <fingerprint>
```

Push requires a clean tree/index, an existing commit, the current checked-out branch, and exactly one standard `github.com` push destination. It pushes the reviewed commit ID to that branch. It does not force, configure an upstream, fetch, create a release, or publish packages. Server-side protections can still reject a push.

Embedded HTTPS credentials are rejected. Configure authentication separately through your trusted Git setup. SSH host configuration and Git credential helpers remain part of that trusted environment. Push hooks and push signing are disabled. GitHub Enterprise and non-GitHub hosts are not supported by this helper.

## Version updates

The default target is **Codeitz itself**, not CODEBIZ and not every child app. Pass `--root` to select another existing package root.

### Inspect and check

```bash
node codeitz/tools/version-update.mjs show
node codeitz/tools/version-update.mjs check
```

Both inspect the selected root package and check supported existing lock/app metadata for version consistency. They do not compare every dependency range, inspect every workspace, or verify deployed versions.

### Prepare a version

```bash
node codeitz/tools/version-update.mjs bump --level patch --title "Improve generator diagnostics"
node codeitz/tools/version-update.mjs set --root /tmp/alpha --version 1.2.3 --title "Prepare app version"
```

Use `patch`, `minor`, or `major`, or set an explicit greater stable version. Prerelease/build labels, leading-zero versions, downgrades, and unsafe integer components are rejected.

After reviewing the preview:

```bash
node codeitz/tools/version-update.mjs bump --level patch --title "Improve generator diagnostics" --apply --expect <fingerprint>
```

Supported changes are deliberately narrow:

| File | Behavior |
| --- | --- |
| `package.json` | Update selected root version |
| Existing `package-lock.json` | Update top-level and root package versions for npm v2/v3 locks |
| Existing `app.manifest.json` | Update matching version for schema version 1 |
| Changelog | Preserve history and add a local version-preparation entry |

Workspace package versions, dependency ranges, downloaded lock entries, platform-native manifests, environment samples, infrastructure pins, and migration approvals are not rewritten. Missing lockfiles are not generated. Existing metadata disagreement, unsupported locks, or `npm-shrinkwrap.json` stop the operation.

Default changelog: existing `docs/changelog.md`, otherwise `CHANGELOG.md`. Override with `--changelog <relative-path.md>`. Dates use Asia/Kolkata; `--date YYYY-MM-DD` selects an explicit date and keeps a preview stable across midnight.

Version preparation does not imply release, publication, deployment, database compatibility, or migration execution. The tool does not infer database changes from file names.

### Maintenance journals and rollback

Version changes use the shared engine's path checks, cooperative lock, backups, and per-file write mechanisms. They record separate journals under `.codeitz/tool-runs/<run-id>/` and do not rewrite `.codeitz/state.json`.

```bash
node codeitz/tools/version-update.mjs rollback --run <run-id>
node codeitz/tools/version-update.mjs rollback --run <run-id> --apply --expect <fingerprint>
```

Use `--root` for a different package root. Preview validates current target hashes and backups. Later edits to any affected file block rollback. The tool restores prior content and removes a newly created changelog only when it still matches that run. Unrelated changes remain untouched.

These journals are separate from scaffold runs: `runner.mjs rollback` handles scaffold runs; this command handles maintenance runs. A version edit to generator-managed metadata intentionally leaves its generator hash unchanged, so a later scaffold upgrade detects the edit and refuses to reset the version. Ownership migration and field-level merging are not implemented.

Multi-file writes and rollback are not crash-atomic. Ordinary-error recovery is best-effort. Prepared or recovery-required maintenance journals need the same reviewed manual inspection described in [upgrades and recovery](upgrades-and-recovery.md#interrupted-runs).

## Verification and provenance

From `codeitz/`, npm aliases are also available: `npm run github -- <command> ...`, `npm run version:show`, `npm run version:check`, and `npm run version:bump -- --title "Describe the change"`. The same preview and fingerprint rules apply.

```bash
node --test codeitz/tests/*.test.mjs
```

Git mutations are exercised only in disposable test repositories. Push execution is tested with a Git stub; no push is sent to GitHub. See the [audit](audits/2026-11-15-codexsun-tools.md) for source findings and intentional adaptations.

[Documentation home](README.md)

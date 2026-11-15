# CODEXSUN GitHub and version tooling audit

Reviewed: **15 November 2026**.

Source: [CODEXSUN/codexsun](https://github.com/CODEXSUN/codexsun/tree/5e33dfc44499a92fe703e84ca0419913ba57c652), commit `5e33dfc44499a92fe703e84ca0419913ba57c652`. The remote HEAD was checked and matched this snapshot.

## Scope

Static review of `tools/github-helper.mjs`, `tools/version-bump.mjs`, `tools/version/version.mjs`, `tools/check-versions.mjs`, `tools/changelog.mjs`, and the version-bump tests and documentation. This is a targeted tooling audit, not a fresh security or application audit of the entire repository. Upstream write commands were not executed.

## Findings

| Priority | Source evidence | Practical effect | Codeitz adaptation |
| --- | --- | --- | --- |
| High | [Git helper](https://github.com/CODEXSUN/codexsun/blob/5e33dfc44499a92fe703e84ca0419913ba57c652/tools/github-helper.mjs): optional version bump executes before the final continuation prompt | Cancellation after the bump can leave package/changelog changes | Version writes are a separate, fingerprint-reviewed command |
| High | Same helper performs `git add -A`, commit, and push as one sequence | Unrelated changes can enter the commit and be pushed | Commit only the reviewed staged snapshot; push is separate |
| High | Same helper performs `pull --rebase --autostash` before staging | Repository history/worktree can change after the initial review | No automatic pull, rebase, or stash |
| High | [Version bump](https://github.com/CODEXSUN/codexsun/blob/5e33dfc44499a92fe703e84ca0419913ba57c652/tools/version-bump.mjs) writes packages before processing remaining lock/changelog/native files | A later failure can leave a partial version update | Preflight all selected metadata, review hashes, back up and journal changes |
| High | [Version CLI](https://github.com/CODEXSUN/codexsun/blob/5e33dfc44499a92fe703e84ca0419913ba57c652/tools/version/version.mjs): explicit-version path edits root only; implicit bump delegates to workspace updater | Different entry paths have different consistency guarantees; explicit versions are not validated there | One scoped update path for bump/set, with matching existing metadata checks |
| Medium | Workspace updater synchronizes all matched packages and selected internal ranges | Appropriate to its lockstep repository, but incompatible with independent CODEBIZ child releases | One package root per operation; never traverse children |
| Medium | Database-change detection uses tracked `git diff HEAD` and converts Git errors to an empty list | Untracked migrations are omitted; failed inspection can appear to mean no database change | No automatic database compatibility claim |
| Medium | Patch parser permits leading zeros, validates only the parsed patch, and does not check increment overflow | Unsupported versions or an unsafe next patch can pass part of validation | Validate all stable-version components and increment bounds |
| Medium | Timestamp behavior differs between host-local formatting and explicit Asia/Kolkata formatting | The same workflow can produce inconsistent dates | Explicit Asia/Kolkata default and validated date override |

These are observed code paths and design risks, not reports of an exploited production incident. Some behavior is deliberate for CODEXSUN's current release model; it should not be transplanted into independent-repository tooling unchanged.

## Useful upstream ideas retained

- A visible review before Git operations.
- Strict separation between application version and infrastructure pins.
- Package/lock/changelog consistency checks.
- Reusable version operations and readable release history.

The Codeitz tools are a source-informed reimplementation, not verbatim copies. They do not include CODEXSUN-specific Windows manifests, environment samples, changelog formats, or lockstep dependency rewriting. Machine-readable provenance is recorded in [tools/provenance.json](../../tools/provenance.json).

## Verification and limits

Codeitz checks cover staged-only commits, literal commit messages, hooks disabled, stale reviews, root scope, remote validation, pinned push arguments, metadata consistency, child-version preservation, history preservation, rollback, and write-error recovery. All Git writes occur in disposable test repositories; push uses a stub and contacts no remote.

Real GitHub authentication, protected branches, remote push execution, Windows behavior, crash recovery, and publication were not verified. Both tools require a trusted, stable checkout. Commit signing and hooks are deliberately bypassed; use normal Git for workflows that require them. File journals are not a multi-file crash transaction.

[Tool guide](../development-tools.md) · [Documentation home](../README.md)

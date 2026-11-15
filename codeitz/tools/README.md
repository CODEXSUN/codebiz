# Codeitz maintenance tools

Explicit developer operations, separate from scaffolding. No dependency installation is needed; Git commands require Git on PATH.

| Tool | Purpose |
| --- | --- |
| [github-helper.mjs](github-helper.mjs) | Inspect a repository; separately review staged commits and pushes |
| [version-update.mjs](version-update.mjs) | Inspect, check, prepare, or roll back a package version update |

Mutation defaults to preview. Apply requires both `--apply` and the exact preview's `--expect` fingerprint. Creating these tools does not authorize invoking their mutations.

Read the [usage and recovery guide](../docs/development-tools.md) and [source audit](../docs/audits/2026-11-15-codexsun-tools.md).

# Working on Codeitz

Keep changes scoped to the requested capability. Preserve unrelated workspace files.

## Documentation maintenance

Read `docs/development.md` before changing Codeitz behavior. Update the relevant guide in the same change as generator output, CLI, safety, ownership, or recovery behavior.

- Keep `README.md` short; place detailed instructions under `docs/`.
- Update `docs/generators.md` for commands, options, prerequisites, and generated output.
- Update `docs/architecture.md` for component responsibilities and data flow.
- Update `docs/upgrades-and-recovery.md` for state, conflicts, writes, and rollback.
- Update `docs/status.md` for implemented capabilities and known limitations.
- Update `docs/development-tools.md` for Git/version maintenance behavior. Keep source audit evidence tied to its reviewed commit.
- Add an Unreleased entry in `docs/changelog.md` for meaningful behavior changes.
- Keep planned capabilities explicitly marked as planned. Generated metadata is not a running feature.
- Check links and examples after documentation changes. Do not rerun the engine suite for prose-only changes unless they expose behavioral uncertainty.

## Implementation boundaries

Templates build plans; the shared engine performs writes. Keep dry-run as the default. Do not add force overwrite, arbitrary executable hooks, installation, Git operations, or deployment as incidental generator behavior.

Dedicated tools under `tools/` may implement explicit maintenance operations. They must remain separate from scaffolding, default to preview, and require both `--apply` and a matching reviewed fingerprint for mutation. Creating or editing a tool does not authorize running its Git, version, or network mutations in the user's repository. Test mutations in disposable fixtures; stub remote pushes.

For behavior changes, run appropriate tests and cover preservation and failure handling. Preview new templates in temporary destinations. Do not apply the workspace blueprint to the user's working tree merely to verify documentation.

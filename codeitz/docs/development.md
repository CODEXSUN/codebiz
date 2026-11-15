# Developing Codeitz

Develop one generator or safety capability at a time. Keep filesystem behavior in the shared engine.

## Daily workflow

1. Define one observable outcome.
2. Read the owning generator, registry entry, relevant engine behavior, and guide.
3. Change the smallest necessary component.
4. Add meaningful tests, especially for preservation and failure cases.
5. Preview in a disposable destination.
6. Verify repeat generation and upgrades when output changes.
7. Update documentation in the same change.
8. Report verification and limitations.

Do not apply the blueprint to the user's working tree as a test.

## Add a generator

1. Add a template with a pure `build()` function.
2. Use shared name validation and plan helpers.
3. Register supported options in `lib/registry.mjs`.
4. Delegate direct execution to the runner.
5. Test output, ownership, conflicts, and independent roots where applicable.
6. Document the command and its actual output.

Avoid empty implementation layers and fictional runtime commands. Keep job/agent execution disabled until implemented.

## Change template output

Increment `templateVersion` in `template/lib/plan.mjs` when generated output changes. That version identifies the template revision; it does not automatically migrate state schemas or ownership.

Verify clean generation, repeat runs, unchanged managed-file upgrades, local edits/deletions, and unmanaged conflicts.

Renames, removals, and breaking metadata changes require a migration design. The upgrader does not delete stale files or migrate application data.

## Verification

From the CODEBIZ root:

```bash
node --test codeitz/tests/*.test.mjs
```

Or from `codeitz/`:

```bash
npm test
```

The suite covers previews, repeat runs, ownership, upgrades/rollback, invalid paths, links, locking, independent roots, CLI validation, write-error recovery, and corrupt state.

It also verifies the separate [maintenance tools](development-tools.md) in disposable repositories. Push execution is stubbed; tests do not push to GitHub. Keep maintenance commands separate from generators and never introduce implicit Git/version operations into scaffolding.

For prose-only changes, check links and examples against the implementation. Run behavioral checks only when necessary to resolve uncertainty.

## Documentation update map

| Change | Update |
| --- | --- |
| Commands, options, prerequisites, output | `generators.md`; introductory examples in `getting-started.md` |
| Source layout or ownership | `architecture.md` |
| State, conflicts, writes, upgrade, rollback | `upgrades-and-recovery.md` |
| Git/version commands and maintenance journals | `development-tools.md`; audit findings only when their evidence changes |
| Development workflow | This guide; `../AGENTS.md` when needed |
| Capability or known limitation | `status.md` |
| Meaningful behavior change | Unreleased section in `changelog.md` |
| New page | Documentation index; repository README if useful |

Keep detailed instructions in one guide and link to them. Use descriptive headings, short paragraphs, concrete examples, and tables for comparisons. Mark planned work clearly.

Documentation is maintained with each development change, not by an unattended background process.

## Release notes

Explain what changed and its practical effect. Record template/state compatibility or recovery implications. Move Unreleased notes into a dated release only when that release is actually prepared. Documentation edits do not imply publication.

[Documentation home](README.md)

# Getting started

## 1. Check your environment

Use Node.js 22 or later. Codeitz requires no dependency installation.

From the CODEBIZ root:

```bash
node --version
node codeitz/runner.mjs --help
node codeitz/runner.mjs list
```

## 2. Preview the workspace

```bash
node codeitz/template/structure/folder.mjs
```

The blueprint includes Framework, Platform, standalone Zetro, shared UI and messaging packages, workers and queues, automation, MCP governance, and child-app locations.

To write the reviewed structure:

```bash
node codeitz/template/structure/folder.mjs --apply
```

This creates directories only. It does not register app generators or implement services. Git does not track empty directories, and Codeitz does not insert placeholder files.

## 3. Prepare an app

Preview, then apply:

```bash
node codeitz/runner.mjs app --name reference-alpha
node codeitz/runner.mjs app --name reference-alpha --apply
```

The app appears under `apps/reference-alpha/` with independent package metadata, an app manifest, and feature locations. It has no implemented runtime or dependency lockfile yet.

## 4. Add one feature

After applying the app:

```bash
node codeitz/runner.mjs module --app reference-alpha --name records
```

Review the result and add `--apply` to create it. See the [generator guide](generators.md) for other features.

## 5. Choose a destination

```bash
node codeitz/runner.mjs workspace --root /tmp/codebiz-preview
```

Create the destination directory first. Missing roots and symlink roots/ancestors are refused. The default root is the parent of the Codeitz checkout, regardless of the shell's current directory. Check the printed root before applying.

## 6. Prepare an independent child app

With an existing destination such as `/tmp/alpha`:

```bash
node codeitz/runner.mjs app --name reference-alpha --standalone --root /tmp/alpha
node codeitz/runner.mjs app --name reference-alpha --standalone --root /tmp/alpha --apply
node codeitz/runner.mjs module --app reference-alpha --name records --standalone --root /tmp/alpha
```

`--standalone` targets the root directly instead of adding an `apps/reference-alpha/` prefix. Use the same flag and root for later app-specific commands.

Codeitz does not initialize Git, attach submodules, install dependencies, or deploy. Each destination owns its generation state. Read [ownership and state](upgrades-and-recovery.md#ownership-and-state) before extracting an already-managed app.

[Documentation home](README.md)

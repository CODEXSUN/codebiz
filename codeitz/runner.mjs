#!/usr/bin/env node
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { apply, inspect, readState, resolveRoot, rollback, safePath, stat } from './lib/engine.mjs';
import { build, buildUpgrade, generators } from './lib/registry.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const usage = `Codeitz — reusable scaffolding, no generated code execution

  node codeitz/runner.mjs <generator> [options]
  node codeitz/runner.mjs upgrade [--root <directory>] [--apply]
  node codeitz/runner.mjs rollback --run <id> [--root <directory>] [--apply]
  node codeitz/runner.mjs list

Generators: workspace, app, module, event, job, worker, agent, package
  --name <kebab-case>   App, module, event, job, agent or package name
  --app <kebab-case>    Owning app for module/event/job/worker/agent
  --root <directory>   Existing destination directory (default: Codeitz parent)
  --standalone         Target an independent app repository directly
  --apply              Apply the reviewed operation (default is dry-run)
  --dry-run            Explicit preview; cannot be combined with --apply
  --json               Machine-readable preview/result

Examples:
  node codeitz/runner.mjs workspace
  node codeitz/runner.mjs app --name reference-alpha --apply
  node codeitz/runner.mjs module --app reference-alpha --name records
  node codeitz/runner.mjs event --app reference-alpha --name record-created
  node codeitz/runner.mjs app --name reference-alpha --root /tmp/alpha --standalone

No stale-file deletion, force overwrite, installation, Git operation or deployment command exists.
`;

function parse(argv) {
  const command = argv[0] ?? 'help';
  const options = {};
  const flags = new Set(['apply', 'dry-run', 'standalone', 'json']);
  const values = new Set(['root', 'name', 'app', 'run']);
  for (let index = 1; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${argument}`);
    if (flags.has(key)) options[key] = true;
    else if (values.has(key)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} requires a value.`);
      options[key] = value;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.apply && options['dry-run']) throw new Error('Choose --apply or --dry-run, not both.');
  return { command, options };
}

function printPreview(preview, asJson) {
  const actions = preview.actions.filter((entry) => !['keep-directory', 'unchanged-file'].includes(entry.type));
  const publicActions = actions.map(({ type, path: filePath, reason, beforeHash, afterHash, content }) => ({
    type, path: filePath, ...(reason ? { reason } : {}),
    ...(['create-file', 'update-file'].includes(type) ? { beforeHash, afterHash, proposedContent: content } : {}),
  }));
  const summary = { root: preview.root, mode: 'dry-run', templateVersion: preview.plan.templateVersion,
    instances: preview.plan.instances.map((entry) => entry.id), actions: publicActions, conflicts: preview.conflicts.length };
  if (asJson) console.log(JSON.stringify(summary, null, 2));
  else {
    console.log(`Codeitz preview: ${preview.root}`);
    for (const action of publicActions.slice(0, 60)) console.log(`  ${action.type}: ${action.path}${action.reason ? ` — ${action.reason}` : ''}`);
    if (actions.length > 60) console.log(`  … ${actions.length - 60} more actions (use --json for all).`);
    console.log(`${actions.length} planned actions; ${preview.conflicts.length} conflicts. Nothing written.`);
  }
}

async function requireApp(root, command, options) {
  if (!['module', 'event', 'job', 'worker', 'agent'].includes(command)) return;
  const relative = options.standalone ? 'app.manifest.json' : `apps/${options.app}/app.manifest.json`;
  const manifestPath = await safePath(root, relative);
  const entry = await stat(manifestPath);
  if (!entry || !entry.isFile()) throw new Error(`Create the app first; missing ${relative}.`);
  const manifest = JSON.parse(await fs.readFile(manifestPath, 'utf8'));
  if (manifest.schemaVersion !== 1 || manifest.id !== options.app) throw new Error('App manifest does not match the selected app.');
}

export async function execute(command, options = {}) {
  const root = await resolveRoot(options.root ?? defaultRoot);
  if (command === 'rollback') {
    for (const key of ['name', 'app', 'standalone']) if (options[key] !== undefined) throw new Error(`rollback does not accept --${key}.`);
    const result = await rollback(root, options.run, { apply: Boolean(options.apply) });
    console.log(JSON.stringify({ mode: options.apply ? 'applied' : 'dry-run', ...result }, null, 2));
    return;
  }
  let plan;
  if (command === 'upgrade') {
    for (const key of ['name', 'app', 'standalone', 'run']) if (options[key] !== undefined) throw new Error(`upgrade does not accept --${key}.`);
    const { state } = await readState(root);
    if (!Object.keys(state.instances).length) throw new Error('No registered generators to upgrade. Apply a generator first.');
    plan = await buildUpgrade(state);
  } else {
    if (options.run !== undefined) throw new Error('--run is only valid for rollback.');
    const templateOptions = Object.fromEntries(['name', 'app', 'standalone'].filter((key) => options[key] !== undefined).map((key) => [key, options[key]]));
    plan = await build(command, templateOptions);
    await requireApp(root, command, templateOptions);
  }
  const engineOptions = { upgrade: command === 'upgrade' };
  const preview = await inspect(root, plan, engineOptions);
  if (!options.apply) {
    printPreview(preview, options.json);
    if (preview.conflicts.length) process.exitCode = 2;
    return;
  }
  if (preview.conflicts.length) {
    printPreview(preview, options.json);
    throw new Error('Conflicts prevent the entire operation; no target changes were applied.');
  }
  const result = await apply(root, plan, engineOptions);
  console.log(JSON.stringify({ root, mode: 'applied', ...result }, null, 2));
}

export async function main(argv = process.argv.slice(2)) {
  try {
    const { command, options } = parse(argv);
    if (['help', '--help', '-h'].includes(command)) { console.log(usage); return; }
    if (command === 'list') { console.log(Object.keys(generators).join('\n')); return; }
    await execute(command, options);
  } catch (error) {
    console.error(`Codeitz: ${error.message}`);
    process.exitCode = 1;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) await main();

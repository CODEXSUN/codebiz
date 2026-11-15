import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { apply, inspect, readState, rollback, validateRelative } from '../lib/engine.mjs';
import { build, buildUpgrade } from '../lib/registry.mjs';
import { plan } from '../template/lib/plan.mjs';

const runner = fileURLToPath(new URL('../runner.mjs', import.meta.url));
async function temporary(t) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codeitz-test-'));
  t.after(() => fs.rm(directory, { recursive: true, force: true }));
  return directory;
}
const exists = async (target) => fs.access(target).then(() => true, () => false);
const cli = (...args) => spawnSync(process.execPath, [runner, ...args], { encoding: 'utf8' });

test('workspace preview has the agreed boundaries and writes nothing', async (t) => {
  const root = await temporary(t);
  const blueprint = await build('workspace');
  assert(blueprint.directories.includes('zetro/providers'));
  assert(blueprint.directories.includes('packages/messaging/outbox'));
  assert(blueprint.directories.includes('workers/queue/retries'));
  assert(!blueprint.directories.some((entry) => entry.startsWith('framework/ai')));
  assert.equal(blueprint.files.length, 0);
  const preview = await inspect(root, blueprint);
  assert.equal(preview.conflicts.length, 0);
  assert.deepEqual(await fs.readdir(root), []);
});

test('workspace apply creates folders only and is idempotent', async (t) => {
  const root = await temporary(t);
  const blueprint = await build('workspace');
  assert.equal((await apply(root, blueprint)).changed, true);
  assert(await exists(path.join(root, 'apps/database-manager/api/src/modules/backups')));
  assert.equal(await exists(path.join(root, 'apps/database-manager/package.json')), false);
  assert.equal((await apply(root, blueprint)).changed, false);
});

test('app is independent metadata, and repeat generation preserves added files', async (t) => {
  const root = await temporary(t);
  const blueprint = await build('app', { name: 'sample-app' });
  await apply(root, blueprint);
  const pkg = JSON.parse(await fs.readFile(path.join(root, 'apps/sample-app/package.json'), 'utf8'));
  assert.equal(pkg.name, '@codebiz/sample-app');
  assert.equal(pkg.scripts, undefined);
  await fs.writeFile(path.join(root, 'apps/sample-app/api/custom.ts'), 'user code');
  assert.equal((await apply(root, blueprint)).changed, false);
  assert.equal(await fs.readFile(path.join(root, 'apps/sample-app/api/custom.ts'), 'utf8'), 'user code');
});

test('one unmanaged conflict blocks all generated files and directories', async (t) => {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, 'apps/sample-app'), { recursive: true });
  await fs.writeFile(path.join(root, 'apps/sample-app/README.md'), 'existing work');
  const blueprint = await build('app', { name: 'sample-app' });
  await assert.rejects(apply(root, blueprint), /Conflicts/);
  assert.equal(await exists(path.join(root, 'apps/sample-app/api')), false);
  assert.equal(await exists(path.join(root, '.codeitz')), false);
});

test('matching unmanaged files are preserved without taking ownership', async (t) => {
  const root = await temporary(t);
  await fs.writeFile(path.join(root, 'note.txt'), 'same');
  const blueprint = plan('test', {}, [], { 'note.txt': 'same' });
  await apply(root, blueprint);
  assert.equal((await readState(root)).state.files['note.txt'], undefined);
  assert.equal((await inspect(root, plan('test', {}, [], { 'note.txt': 'different' }), { upgrade: true })).conflicts.length, 1);
});

test('upgrade replaces only unchanged managed content and rollback restores it', async (t) => {
  const root = await temporary(t);
  const first = plan('test', {}, ['extra'], { 'extra/note.txt': 'v1' });
  await apply(root, first);
  const second = plan('test', {}, ['extra'], { 'extra/note.txt': 'v2' });
  second.templateVersion = '1.1.0';
  assert.equal((await inspect(root, second)).conflicts.length, 1);
  const result = await apply(root, second, { upgrade: true });
  assert.equal(await fs.readFile(path.join(root, 'extra/note.txt'), 'utf8'), 'v2');
  await rollback(root, result.runId, { apply: true });
  assert.equal(await fs.readFile(path.join(root, 'extra/note.txt'), 'utf8'), 'v1');
});

test('local edits and local deletions block upgrade', async (t) => {
  const root = await temporary(t);
  const blueprint = plan('test', {}, [], { 'note.txt': 'v1' });
  await apply(root, blueprint);
  await fs.writeFile(path.join(root, 'note.txt'), 'local edit');
  await assert.rejects(apply(root, plan('test', {}, [], { 'note.txt': 'v2' }), { upgrade: true }), /Conflicts/);
  await fs.unlink(path.join(root, 'note.txt'));
  await assert.rejects(apply(root, blueprint, { upgrade: true }), /Conflicts/);
});

test('rollback previews without mutation and preserves unrelated directory contents', async (t) => {
  const root = await temporary(t);
  const result = await apply(root, plan('test', {}, ['extra'], { 'extra/note.txt': 'v1' }));
  await fs.writeFile(path.join(root, 'extra/user.txt'), 'keep');
  await rollback(root, result.runId);
  assert(await exists(path.join(root, 'extra/note.txt')));
  await rollback(root, result.runId, { apply: true });
  assert.equal(await exists(path.join(root, 'extra/note.txt')), false);
  assert.equal(await fs.readFile(path.join(root, 'extra/user.txt'), 'utf8'), 'keep');
});

test('rollback refuses edited files and later generator state', async (t) => {
  const root = await temporary(t);
  const result = await apply(root, plan('test', {}, [], { 'note.txt': 'v1' }));
  await fs.writeFile(path.join(root, 'note.txt'), 'local edit');
  await assert.rejects(rollback(root, result.runId, { apply: true }), /Edited/);
  await fs.writeFile(path.join(root, 'note.txt'), 'v1');
  await apply(root, plan('another', {}, [], { 'other.txt': 'other' }));
  await assert.rejects(rollback(root, result.runId, { apply: true }), /Later state/);
});

test('traversal, reserved names, invalid names and conflicting paths are rejected', async (t) => {
  for (const value of ['../escape', '/tmp/escape', 'a/../../escape', 'a\\b', '.git/config', '.codeitz/state.json', 'node_modules/x', 'C:/x']) {
    assert.throws(() => validateRelative(value));
  }
  for (const value of ['../escape', 'Bad Name', '-bad', 'a/b']) await assert.rejects(build('app', { name: value }));
  const root = await temporary(t);
  await assert.rejects(inspect(root, plan('test', {}, ['same'], { same: 'x' })), /Conflicting/);
  await assert.rejects(inspect(root, plan('test', {}, ['Same', 'same'])), /Case-colliding/);
});

test('symlink destinations, roots and metadata cannot be followed', async (t) => {
  const root = await temporary(t);
  const outside = await temporary(t);
  await fs.symlink(outside, path.join(root, 'apps'));
  await assert.rejects(apply(root, await build('app', { name: 'sample' })), /Symlink/);
  await fs.symlink(outside, path.join(root, 'alias'));
  await assert.rejects(inspect(path.join(root, 'alias'), plan('test', {}, [])), /symlink/);
  await fs.symlink(outside, path.join(root, '.codeitz'));
  await assert.rejects(inspect(root, plan('test', {}, [])), /Symlink/);
  assert.deepEqual(await fs.readdir(outside), []);
});

test('hard-linked target files are rejected', async (t) => {
  const root = await temporary(t);
  await fs.writeFile(path.join(root, 'original'), 'keep');
  await fs.link(path.join(root, 'original'), path.join(root, 'linked'));
  await assert.rejects(apply(root, plan('test', {}, [], { linked: 'keep' })), /Hard-linked/);
});

test('cooperative lock prevents a concurrent apply', async (t) => {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, '.codeitz/lock'), { recursive: true });
  await assert.rejects(apply(root, plan('test', {}, [], { 'note.txt': 'v1' })), /locked/);
  assert.equal(await exists(path.join(root, 'note.txt')), false);
});

test('all reusable generators support an independent app checkout', async (t) => {
  const root = await temporary(t);
  await apply(root, await build('app', { name: 'sample', standalone: true }));
  for (const generator of ['module', 'event', 'job', 'worker', 'agent']) {
    const options = { app: 'sample', standalone: true, ...(generator === 'worker' ? {} : { name: 'example' }) };
    await apply(root, await build(generator, options));
  }
  assert.equal(await exists(path.join(root, 'apps')), false);
  assert(await exists(path.join(root, 'api/src/modules/example/module.manifest.json')));
  assert(await exists(path.join(root, 'contracts/events/example.v1.schema.json')));
  const manifest = JSON.parse(await fs.readFile(path.join(root, 'agents/definitions/example/agent.manifest.json'), 'utf8'));
  assert.equal(manifest.enabled, false);
  assert.deepEqual(manifest.tools, []);
  const upgraded = await buildUpgrade((await readState(root)).state);
  assert.equal((await apply(root, upgraded, { upgrade: true })).changed, false);
});

test('CLI defaults to dry-run, requires an app, and rejects unsupported options', async (t) => {
  const root = await temporary(t);
  const preview = cli('app', '--name', 'sample', '--root', root, '--json');
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(JSON.parse(preview.stdout).mode, 'dry-run');
  assert.deepEqual(await fs.readdir(root), []);
  assert.equal(cli('module', '--app', 'missing', '--name', 'example', '--root', root).status, 1);
  assert.equal(cli('app', '--name', 'sample', '--root', root, '--force').status, 1);
  assert.equal(cli('app', '--name', 'sample', '--root', root, '--apply', '--dry-run').status, 1);
  assert.equal(cli('workspace', '--app', 'sample', '--root', root).status, 1);
  assert.equal(cli('app', '--name', 'sample', '--root', root, '--apply').status, 0);
  assert.equal(cli('module', '--app', 'sample', '--name', 'example', '--root', root, '--apply').status, 0);
  assert.equal(cli('upgrade', '--root', root).status, 0);
});

test('templates can be invoked directly using the same safe runner', async (t) => {
  const root = await temporary(t);
  const template = fileURLToPath(new URL('../template/structure/folder.mjs', import.meta.url));
  const result = spawnSync(process.execPath, [template, '--root', root, '--json'], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(JSON.parse(result.stdout).mode, 'dry-run');
  assert.deepEqual(await fs.readdir(root), []);
});

test('a mid-apply write error restores earlier writes and removes empty generated directories', async (t) => {
  const root = await temporary(t);
  const original = fs.writeFile.bind(fs);
  const mock = t.mock.method(fs, 'writeFile', async (filePath, ...args) => {
    if (String(filePath).startsWith(path.join(root, 'new/b.txt.tmp-'))) throw new Error('Simulated write failure');
    return original(filePath, ...args);
  });
  await assert.rejects(apply(root, plan('test', {}, ['new'], { 'new/a.txt': 'a', 'new/b.txt': 'b' })), /Simulated write failure/);
  mock.mock.restore();
  assert.equal(await exists(path.join(root, 'new')), false);
  assert.equal((await readState(root)).raw, null);
  const runs = await fs.readdir(path.join(root, '.codeitz/runs'));
  const journal = JSON.parse(await fs.readFile(path.join(root, '.codeitz/runs', runs[0], 'journal.json'), 'utf8'));
  assert.equal(journal.status, 'reverted');
});

test('corrupt ownership state is rejected rather than discarded', async (t) => {
  const root = await temporary(t);
  await fs.mkdir(path.join(root, '.codeitz'));
  await fs.writeFile(path.join(root, '.codeitz/state.json'), '{"schemaVersion":999}');
  await assert.rejects(apply(root, await build('app', { name: 'sample' })), /Unsupported or corrupt/);
  assert.equal(await exists(path.join(root, 'apps')), false);
});

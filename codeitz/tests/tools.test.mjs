import assert from 'node:assert/strict';
import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { applyReviewedEdits, previewEdits, rollbackReviewedEdits } from '../lib/engine.mjs';
import { githubRemote, parseStatus, repository, reviewCommit, reviewPush } from '../tools/github-helper.mjs';
import { inspectPackage, localDate, nextVersion, parseVersion, prepareVersion } from '../tools/version-update.mjs';

const versionTool = fileURLToPath(new URL('../tools/version-update.mjs', import.meta.url));
const githubTool = fileURLToPath(new URL('../tools/github-helper.mjs', import.meta.url));
async function temporary(t) {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'codeitz-tools-'));
  t.after(() => fs.rm(root, { recursive: true, force: true }));
  return root;
}
const read = (root, relative) => fs.readFile(path.join(root, relative), 'utf8');
const exists = async (root, relative) => fs.access(path.join(root, relative)).then(() => true, () => false);
const git = (root, ...args) => execFileSync('git', ['-C', root, ...args], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const cli = (tool, args, env = {}) => spawnSync(process.execPath, [tool, ...args], { encoding: 'utf8', env: { ...process.env, ...env } });

async function packageRoot(t, { lockVersion = 3 } = {}) {
  const root = await temporary(t);
  const pkg = { name: '@example/app', version: '1.2.3', workspaces: ['apps/*'], dependencies: { '@example/other': '^4.0.0' } };
  await fs.writeFile(path.join(root, 'package.json'), JSON.stringify(pkg));
  await fs.writeFile(path.join(root, 'app.manifest.json'), JSON.stringify({ schemaVersion: 1, id: 'app', version: '1.2.3' }));
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify({ name: pkg.name, version: pkg.version, lockfileVersion: lockVersion,
    packages: { '': { ...pkg }, 'apps/child': { version: '7.8.9' }, 'node_modules/other': { version: '4.0.0', integrity: 'preserved' } } }));
  await fs.mkdir(path.join(root, 'apps/child'), { recursive: true });
  await fs.writeFile(path.join(root, 'apps/child/package.json'), '{"version":"7.8.9"}');
  return root;
}

async function gitRoot(t) {
  const root = await temporary(t);
  git(root, 'init', '-b', 'main');
  git(root, 'config', 'user.name', 'Codeitz Test');
  git(root, 'config', 'user.email', 'test@example.invalid');
  git(root, 'config', 'commit.gpgsign', 'false');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'base\n');
  git(root, 'add', '--', 'tracked.txt');
  git(root, 'commit', '-m', 'fixture');
  return root;
}

test('stable versions reject malformed, leading-zero and overflowing components', () => {
  assert.deepEqual(parseVersion('1.2.3'), [1, 2, 3]);
  assert.equal(nextVersion('1.2.3'), '1.2.4');
  assert.equal(nextVersion('1.2.3', 'minor'), '1.3.0');
  assert.equal(nextVersion('1.2.3', 'major'), '2.0.0');
  for (const value of ['1.2', '1.2.3.4', '01.2.3', '1.2.3-beta', '1.2.9007199254740992']) assert.throws(() => parseVersion(value));
  assert.throws(() => nextVersion('1.2.9007199254740991'));
  assert.throws(() => nextVersion('1.2.3', 'unknown'));
  assert.throws(() => nextVersion('1.2.3', 'constructor'));
});

test('version preview is read-only and uses the client timezone', async (t) => {
  const root = await packageRoot(t);
  const before = await read(root, 'package.json');
  const preview = await prepareVersion(root, { title: 'Scoped update', date: '2026-11-15' });
  assert.equal(preview.nextVersion, '1.2.4');
  assert.equal(await read(root, 'package.json'), before);
  assert.equal(await exists(root, '.codeitz'), false);
  assert.equal(localDate(new Date('2026-11-14T20:00:00Z')), '2026-11-15');
});

test('version apply updates only selected package metadata, preserves child versions and can roll back', async (t) => {
  const root = await packageRoot(t);
  const original = await read(root, 'package.json');
  const originalLock = await read(root, 'package-lock.json');
  const preview = await prepareVersion(root, { level: 'minor', title: 'API update', date: '2026-11-15' });
  const result = await applyReviewedEdits(root, preview.changes, preview.fingerprint);
  const pkg = JSON.parse(await read(root, 'package.json'));
  const lock = JSON.parse(await read(root, 'package-lock.json'));
  assert.equal(pkg.version, '1.3.0');
  assert.equal(pkg.dependencies['@example/other'], '^4.0.0');
  assert.equal(lock.version, '1.3.0');
  assert.equal(lock.packages[''].version, '1.3.0');
  assert.equal(lock.packages['apps/child'].version, '7.8.9');
  assert.equal(lock.packages['node_modules/other'].integrity, 'preserved');
  assert.equal(JSON.parse(await read(root, 'apps/child/package.json')).version, '7.8.9');
  assert.equal(JSON.parse(await read(root, 'app.manifest.json')).version, '1.3.0');
  const undo = await rollbackReviewedEdits(root, result.runId);
  await rollbackReviewedEdits(root, result.runId, undo.fingerprint);
  assert.equal(await read(root, 'package.json'), original);
  assert.equal(await read(root, 'package-lock.json'), originalLock);
  assert.equal(await exists(root, 'CHANGELOG.md'), false);
});

test('npm v2 root metadata is supported without rewriting dependency lock entries', async (t) => {
  const root = await packageRoot(t, { lockVersion: 2 });
  const preview = await prepareVersion(root, { version: '2.0.0', title: 'Major', date: '2026-11-15' });
  await applyReviewedEdits(root, preview.changes, preview.fingerprint);
  assert.equal((await inspectPackage(root)).pkg.version, '2.0.0');
});

test('version validation fails before writes for stale metadata, downgrades, unsupported locks and bad paths', async (t) => {
  const root = await packageRoot(t);
  for (const version of ['1.2.3', '1.2.2', '1.2.4beta']) await assert.rejects(prepareVersion(root, { version, title: 'bad' }));
  await assert.rejects(prepareVersion(root, { title: 'bad', changelog: '../escape.md' }));
  await assert.rejects(prepareVersion(root, { title: 'bad', date: '2026-02-30' }));
  await fs.writeFile(path.join(root, 'app.manifest.json'), '{"schemaVersion":1,"version":"9.0.0"}');
  await assert.rejects(prepareVersion(root, { title: 'bad' }), /manifest/);
  assert.equal(await exists(root, '.codeitz'), false);
  const oldLock = await packageRoot(t, { lockVersion: 1 });
  await assert.rejects(inspectPackage(oldLock), /lockfileVersion/);
});

test('changelog history and Unreleased content are preserved', async (t) => {
  const root = await packageRoot(t);
  await fs.mkdir(path.join(root, 'docs'));
  await fs.writeFile(path.join(root, 'docs/changelog.md'), '# Changelog\n\n## Unreleased\n\nKeep this draft.\n\n## v1.2.3\n\nHistorical text.\n');
  const preview = await prepareVersion(root, { title: 'Next', date: '2026-11-15' });
  const changelog = preview.changes.find((entry) => entry.path === 'docs/changelog.md').content;
  assert(changelog.indexOf('## Unreleased') < changelog.indexOf('## v1.2.4'));
  assert(changelog.indexOf('## v1.2.4') < changelog.indexOf('## v1.2.3'));
  assert(changelog.includes('Keep this draft.'));
  assert(changelog.includes('Historical text.'));
});

test('review fingerprints reject stale targets and rollback rejects later edits', async (t) => {
  const root = await packageRoot(t);
  const preview = await prepareVersion(root, { title: 'Next', date: '2026-11-15' });
  await fs.appendFile(path.join(root, 'package.json'), '\n');
  await assert.rejects(applyReviewedEdits(root, preview.changes, preview.fingerprint), /stale/);
  const next = await prepareVersion(root, { title: 'Next', date: '2026-11-15' });
  const applied = await applyReviewedEdits(root, next.changes, next.fingerprint);
  await fs.appendFile(path.join(root, 'package.json'), '\n');
  await assert.rejects(rollbackReviewedEdits(root, applied.runId), /Later edits/);
});

test('maintenance write failure restores prior files and leaves a recovery journal', async (t) => {
  const root = await temporary(t);
  await fs.writeFile(path.join(root, 'a.txt'), 'old');
  const changes = [{ path: 'a.txt', content: 'new' }, { path: 'new/b.txt', content: 'b' }];
  const preview = await previewEdits(root, changes);
  const original = fs.writeFile.bind(fs);
  const mocked = t.mock.method(fs, 'writeFile', async (filePath, ...args) => {
    if (String(filePath).startsWith(path.join(root, 'new/b.txt.tmp-'))) throw new Error('Simulated maintenance failure');
    return original(filePath, ...args);
  });
  await assert.rejects(applyReviewedEdits(root, changes, preview.fingerprint), /Simulated maintenance/);
  mocked.mock.restore();
  assert.equal(await read(root, 'a.txt'), 'old');
  assert.equal(await exists(root, 'new'), false);
  const [run] = await fs.readdir(path.join(root, '.codeitz/tool-runs'));
  assert.equal(JSON.parse(await read(root, `.codeitz/tool-runs/${run}/journal.json`)).status, 'reverted');
});

test('version CLI requires explicit apply and exact review fingerprint', async (t) => {
  const root = await packageRoot(t);
  const args = ['bump', '--root', root, '--title', 'Next', '--date', '2026-11-15'];
  const first = cli(versionTool, args);
  assert.equal(first.status, 0, first.stderr);
  const preview = JSON.parse(first.stdout);
  assert.equal(cli(versionTool, [...args, '--apply']).status, 1);
  const applied = cli(versionTool, [...args, '--apply', '--expect', preview.fingerprint]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(JSON.parse(applied.stdout).nextVersion, '1.2.4');
  assert.equal(cli(versionTool, ['check', '--root', root]).status, 0);
  assert.equal(cli(versionTool, ['set', '--root', root, '--title', 'bad']).status, 1);
  assert.equal(cli(versionTool, ['show', '--root', root, '--apply']).status, 1);
});

test('status parsing preserves spaces, newlines and rename source paths', () => {
  const entries = parseStatus('R  new name\0old name\0?? line\nbreak\0 M tracked\0');
  assert.equal(entries[0].path, 'new name');
  assert.equal(entries[0].originalPath, 'old name');
  assert.equal(entries[1].path, 'line\nbreak');
  assert.equal(entries[2].status, ' M');
});

test('GitHub remote validation rejects credential URLs and other destinations', () => {
  assert(githubRemote('git@github.com:CODEXSUN/codebiz.git'));
  assert(githubRemote('https://github.com/CODEXSUN/codebiz.git'));
  assert(githubRemote('ssh://git@github.com/CODEXSUN/codebiz.git'));
  for (const remote of ['https://token@github.com/a/b', 'https://github.com.evil/a/b', 'https://github.com/a/b?token=secret', '/tmp/bare', 'ssh://other@github.com/a/b']) {
    assert.throws(() => githubRemote(remote));
  }
});

test('Git helper refuses implicit parent repository scope', async (t) => {
  const root = await gitRoot(t);
  await fs.mkdir(path.join(root, 'child'));
  await assert.rejects(repository(path.join(root, 'child')), /actual Git root/);
  await assert.rejects(repository(), /explicitly/);
});

test('commit preview writes nothing; apply commits only staged content, without running hooks or shell text', async (t) => {
  const root = await gitRoot(t);
  const marker = path.join(root, 'should-not-exist');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'staged\n');
  git(root, 'add', '--', 'tracked.txt');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'unstaged\n');
  await fs.writeFile(path.join(root, 'unrelated.txt'), 'keep untracked');
  await fs.writeFile(path.join(root, '.git/hooks/pre-commit'), '#!/bin/sh\ntouch should-not-exist\n', { mode: 0o755 });
  const message = `Literal $(touch ${marker}) and backticks \`ignored\``;
  const before = git(root, 'rev-parse', 'HEAD');
  const preview = cli(githubTool, ['commit', '--repo', root, '--message', message]);
  assert.equal(preview.status, 0, preview.stderr);
  assert.equal(git(root, 'rev-parse', 'HEAD'), before);
  assert.equal(cli(githubTool, ['commit', '--repo', root, '--message', message, '--apply']).status, 1);
  const applied = cli(githubTool, ['commit', '--repo', root, '--message', message, '--apply', '--expect', JSON.parse(preview.stdout).fingerprint]);
  assert.equal(applied.status, 0, applied.stderr);
  assert.equal(git(root, 'show', 'HEAD:tracked.txt'), 'staged');
  assert.equal(await read(root, 'tracked.txt'), 'unstaged\n');
  assert.equal(await exists(root, 'should-not-exist'), false);
  assert.equal(git(root, 'log', '-1', '--format=%s'), message);
  assert(git(root, 'status', '--porcelain').includes('unrelated.txt'));
});

test('staged changes after preview invalidate commit approval', async (t) => {
  const root = await gitRoot(t);
  await fs.writeFile(path.join(root, 'tracked.txt'), 'first');
  git(root, 'add', '--', 'tracked.txt');
  const preview = reviewCommit(root, 'Next');
  await fs.writeFile(path.join(root, 'tracked.txt'), 'second');
  git(root, 'add', '--', 'tracked.txt');
  const result = cli(githubTool, ['commit', '--repo', root, '--message', 'Next', '--apply', '--expect', preview.fingerprint]);
  assert.equal(result.status, 1);
  assert.equal(git(root, 'log', '-1', '--format=%s'), 'fixture');
});

test('push preview is offline, clean-tree-only, and bound to the checked-out branch', async (t) => {
  const root = await gitRoot(t);
  git(root, 'remote', 'add', 'origin', 'https://github.com/CODEXSUN/example.git');
  const preview = reviewPush(root, 'origin', 'main');
  assert.equal(preview.head, git(root, 'rev-parse', 'HEAD'));
  assert.equal(await exists(root, '.git/FETCH_HEAD'), false);
  assert.throws(() => reviewPush(root, 'origin', 'other'), /checked-out/);
  await fs.writeFile(path.join(root, 'extra.txt'), 'dirty');
  assert.throws(() => reviewPush(root, 'origin', 'main'), /clean/);
});

test('push apply passes the exact reviewed commit to Git without contacting GitHub', async (t) => {
  const root = await gitRoot(t);
  git(root, 'remote', 'add', 'origin', 'https://github.com/CODEXSUN/example.git');
  const tools = await temporary(t);
  const marker = path.join(tools, 'push-args.json');
  const realGit = execFileSync('which', ['git'], { encoding: 'utf8' }).trim();
  const wrapper = `#!${process.execPath}\nconst fs=require('node:fs');const cp=require('node:child_process');const a=process.argv.slice(2);if(a.includes('push')){fs.writeFileSync(process.env.CODEITZ_TEST_PUSH,JSON.stringify(a));process.stdout.write('simulated push');}else{const r=cp.spawnSync(process.env.CODEITZ_TEST_GIT,a,{stdio:'inherit'});process.exit(r.status??1);}\n`;
  await fs.writeFile(path.join(tools, 'git'), wrapper, { mode: 0o755 });
  const args = ['push', '--repo', root, '--remote', 'origin', '--branch', 'main'];
  const preview = JSON.parse(cli(githubTool, args).stdout);
  const result = cli(githubTool, [...args, '--apply', '--expect', preview.fingerprint], {
    PATH: `${tools}${path.delimiter}${process.env.PATH}`, CODEITZ_TEST_PUSH: marker, CODEITZ_TEST_GIT: realGit,
  });
  assert.equal(result.status, 0, result.stderr);
  const recorded = JSON.parse(await fs.readFile(marker, 'utf8'));
  assert(recorded.includes(`${preview.head}:refs/heads/main`));
  assert(!recorded.some((argument) => ['--force', '--force-with-lease', '--set-upstream'].includes(argument)));
});

test('push rejects multiple destinations and changed remote fingerprints', async (t) => {
  const root = await gitRoot(t);
  git(root, 'remote', 'add', 'origin', 'https://github.com/CODEXSUN/one.git');
  const original = reviewPush(root, 'origin', 'main');
  git(root, 'remote', 'set-url', 'origin', 'https://github.com/CODEXSUN/two.git');
  const result = cli(githubTool, ['push', '--repo', root, '--remote', 'origin', '--branch', 'main', '--apply', '--expect', original.fingerprint]);
  assert.equal(result.status, 1);
  git(root, 'config', '--add', 'remote.origin.pushurl', 'https://github.com/CODEXSUN/one.git');
  git(root, 'config', '--add', 'remote.origin.pushurl', 'https://github.com/CODEXSUN/two.git');
  assert.throws(() => reviewPush(root, 'origin', 'main'), /exactly one/);
});

test('existing null metadata and authoritative shrinkwrap files are rejected', async (t) => {
  const root = await packageRoot(t);
  await fs.writeFile(path.join(root, 'package-lock.json'), 'null');
  await assert.rejects(inspectPackage(root), /Invalid npm lock/);
  const app = await packageRoot(t);
  await fs.writeFile(path.join(app, 'app.manifest.json'), 'null');
  await assert.rejects(inspectPackage(app), /Invalid app manifest/);
  const shrink = await packageRoot(t);
  await fs.writeFile(path.join(shrink, 'npm-shrinkwrap.json'), '{}');
  await assert.rejects(inspectPackage(shrink), /shrinkwrap/);
});

test('version maintenance rejects symlink targets and lock disagreement without writes', async (t) => {
  const root = await packageRoot(t);
  const outside = await temporary(t);
  await fs.writeFile(path.join(outside, 'history.md'), '# Keep');
  await fs.symlink(path.join(outside, 'history.md'), path.join(root, 'CHANGELOG.md'));
  await assert.rejects(prepareVersion(root, { title: 'No overwrite' }), /Symlink/);
  assert.equal(await read(outside, 'history.md'), '# Keep');
  assert.equal(await exists(root, '.codeitz'), false);
  await fs.unlink(path.join(root, 'CHANGELOG.md'));
  const lock = JSON.parse(await read(root, 'package-lock.json'));
  lock.version = '9.0.0';
  await fs.writeFile(path.join(root, 'package-lock.json'), JSON.stringify(lock));
  await assert.rejects(prepareVersion(root, { title: 'No overwrite' }), /versions disagree/);
});

test('Git helper refuses to interfere with a pending merge', async (t) => {
  const root = await gitRoot(t);
  git(root, 'remote', 'add', 'origin', 'https://github.com/CODEXSUN/example.git');
  await fs.writeFile(path.join(root, '.git/MERGE_HEAD'), `${git(root, 'rev-parse', 'HEAD')}\n`);
  assert.throws(() => reviewCommit(root, 'Do not merge'), /existing Git operation/);
  assert.throws(() => reviewPush(root, 'origin', 'main'), /existing Git operation/);
});

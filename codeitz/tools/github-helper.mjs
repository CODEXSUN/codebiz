#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { hash, resolveRoot } from '../lib/engine.mjs';
import { allow, direct, parse, requireReview, singleLine } from './lib/cli.mjs';

const help = `Codeitz GitHub helper

  node codeitz/tools/github-helper.mjs status --repo <repository-root>
  node codeitz/tools/github-helper.mjs commit --repo <root> --message <subject>
  node codeitz/tools/github-helper.mjs push --repo <root> --remote origin --branch <branch>

Commit and push preview by default. Repeat the exact operation with
--apply --expect <fingerprint> to perform it. --dry-run is also accepted.
Commit uses already-staged changes only. No add, pull, rebase, bump, tag or release
is performed. Push has no force or upstream-changing mode. Mutation hooks and
commit signing are disabled; repositories needing hooks/signatures should use
their normal reviewed Git workflow. Git configuration must be trusted.
`;

function scrub(message) {
  return message.replace(/https?:\/\/[^\s'"<>]+/g, (value) => {
    try { const url = new URL(value); url.username = ''; url.password = ''; url.search = ''; url.hash = ''; return url.href; }
    catch { return '[redacted URL]'; }
  });
}

function git(root, args, { optional = false, hooks, indexFile } = {}) {
  const global = ['--no-optional-locks', '-c', 'maintenance.auto=false', '-c', 'gc.auto=0'];
  if (hooks) global.push('-c', `core.hooksPath=${hooks}`, '-c', 'commit.gpgsign=false', '-c', 'push.gpgSign=false');
  try {
    return execFileSync('git', [...global, '-C', root, ...args], {
      encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 64 * 1024 * 1024,
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0', ...(indexFile ? { GIT_INDEX_FILE: indexFile } : {}) },
    });
  } catch (error) {
    if (optional && [1, 128].includes(error.status)) return null;
    throw new Error(`Git ${args[0]} failed: ${scrub(String(error.stderr || error.message)).trim()}`);
  }
}

export async function repository(value) {
  if (!value) throw new Error('--repo must explicitly name the repository root.');
  const root = await resolveRoot(value);
  const top = git(root, ['rev-parse', '--show-toplevel']).trim();
  if (path.resolve(top) !== root) throw new Error('Select the actual Git root; refusing to operate on a parent repository implicitly.');
  return root;
}

export function parseStatus(raw) {
  const fields = raw.split('\0');
  const files = [];
  for (let index = 0; index < fields.length && fields[index]; index++) {
    const field = fields[index];
    const entry = { status: field.slice(0, 2), path: field.slice(3) };
    if (/[RC]/.test(entry.status)) entry.originalPath = fields[++index];
    files.push(entry);
  }
  return files;
}

export function snapshot(root, options = {}) {
  const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD'], { ...options, optional: true })?.trim() ?? null;
  const head = git(root, ['rev-parse', '--verify', 'HEAD'], { ...options, optional: true })?.trim() ?? null;
  const files = parseStatus(git(root, ['status', '--porcelain=v1', '-z', '--untracked-files=all'], options));
  const diff = git(root, ['diff', '--cached', '--binary', '--no-ext-diff', '--no-textconv', '--'], options);
  return { branch, head, files, stagedFingerprint: hash(JSON.stringify({ root, branch, head, diff })) };
}

function requireIdleRepository(root) {
  for (const marker of ['MERGE_HEAD', 'CHERRY_PICK_HEAD', 'REVERT_HEAD', 'rebase-apply', 'rebase-merge', 'sequencer', 'BISECT_LOG']) {
    const location = git(root, ['rev-parse', '--git-path', marker]).trim();
    if (existsSync(path.resolve(root, location))) throw new Error('Finish or explicitly cancel the existing Git operation before using this helper.');
  }
}

export function reviewCommit(root, message, options = {}) {
  requireIdleRepository(root);
  const subject = singleLine(message, 'Commit message');
  const state = snapshot(root, options);
  if (!state.branch) throw new Error('Detached HEAD is not supported for commits.');
  if (state.files.some((entry) => entry.status.includes('U') || ['AA', 'DD'].includes(entry.status))) throw new Error('Resolve the unmerged index before committing.');
  const staged = state.files.filter((entry) => ![' ', '?', '!'].includes(entry.status[0]));
  if (!staged.length) throw new Error('No staged changes. Stage only the intended files yourself, then preview again.');
  return { root, command: 'commit', branch: state.branch, head: state.head, message: subject, staged,
    fingerprint: hash(JSON.stringify({ operation: 'commit', index: state.stagedFingerprint, message: subject })) };
}

export function githubRemote(value) {
  const scp = /^git@github\.com:([A-Za-z0-9_.-]+)\/([A-Za-z0-9_.-]+?)(?:\.git)?$/.exec(value);
  if (scp) return `git@github.com:${scp[1]}/${scp[2]}`;
  let url;
  try { url = new URL(value); } catch { throw new Error('Push requires a GitHub HTTPS or SSH remote.'); }
  if (url.hostname !== 'github.com' || url.port || url.search || url.hash || !['https:', 'ssh:'].includes(url.protocol)) throw new Error('Push requires a standard github.com remote.');
  if ((url.protocol === 'https:' && (url.username || url.password)) || (url.protocol === 'ssh:' && (url.username !== 'git' || url.password))) {
    throw new Error('Embedded credentials are not supported. Configure Git authentication separately.');
  }
  if (!/^\/[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(url.pathname)) throw new Error('Invalid GitHub repository path.');
  return `${url.protocol}//${url.protocol === 'ssh:' ? 'git@' : ''}github.com${url.pathname}`;
}

export function reviewPush(root, remoteValue, branchValue) {
  requireIdleRepository(root);
  const remote = singleLine(remoteValue, 'Remote', 64);
  if (!/^[A-Za-z0-9][A-Za-z0-9_.-]*$/.test(remote)) throw new Error('Remote must be a configured remote name.');
  const branch = singleLine(branchValue, 'Branch');
  git(root, ['check-ref-format', '--branch', branch]);
  const state = snapshot(root);
  if (!state.head || state.branch !== branch) throw new Error('Push branch must match the checked-out branch with an existing commit.');
  if (state.files.length) throw new Error('Push requires a clean working tree and index.');
  const urls = git(root, ['remote', 'get-url', '--push', '--all', remote]).trim().split(/\r?\n/).filter(Boolean);
  if (urls.length !== 1) throw new Error('Remote must have exactly one push destination.');
  const destination = githubRemote(urls[0]);
  return { root, command: 'push', remote, branch, destination, head: state.head,
    fingerprint: hash(JSON.stringify({ operation: 'push', root, remote, branch, destination, head: state.head })) };
}

async function withoutHooks(operation) {
  const directory = await fs.mkdtemp(path.join(os.tmpdir(), 'codeitz-git-hooks-'));
  try { return await operation(directory); }
  finally { await fs.rm(directory, { recursive: true, force: true }); }
}

export async function main(argv = process.argv.slice(2)) {
  const { command, options } = parse(argv, {
    values: ['repo', 'message', 'remote', 'branch', 'expect'], flags: ['apply', 'dry-run'],
  });
  if (['help', '--help', '-h'].includes(command)) { console.log(help); return; }
  const root = await repository(options.repo);
  if (command === 'status') {
    allow(options, ['repo']);
    console.log(JSON.stringify({ root, ...snapshot(root), note: 'Local status only; no fetch was performed.' }, null, 2));
    return;
  }
  if (command === 'commit') {
    allow(options, ['repo', 'message', 'apply', 'dry-run', 'expect']);
    const preview = reviewCommit(root, options.message);
    if (!options.apply) { console.log(JSON.stringify({ mode: 'dry-run', ...preview }, null, 2)); return; }
    requireReview(preview.fingerprint, options.expect);
    const result = await withoutHooks((hooks) => {
      requireReview(reviewCommit(root, options.message).fingerprint, options.expect);
      const tree = git(root, ['write-tree']).trim();
      const indexFile = path.join(hooks, 'reviewed-index');
      git(root, ['read-tree', tree], { indexFile });
      requireReview(reviewCommit(root, options.message, { indexFile }).fingerprint, options.expect);
      return git(root, ['commit', '--no-gpg-sign', '-m', preview.message], { hooks, indexFile });
    });
    console.log(JSON.stringify({ mode: 'applied', command, result: result.trim(), head: snapshot(root).head }, null, 2));
    return;
  }
  if (command === 'push') {
    allow(options, ['repo', 'remote', 'branch', 'apply', 'dry-run', 'expect']);
    const preview = reviewPush(root, options.remote, options.branch);
    if (!options.apply) { console.log(JSON.stringify({ mode: 'dry-run', ...preview }, null, 2)); return; }
    requireReview(preview.fingerprint, options.expect);
    const result = await withoutHooks((hooks) => {
      requireReview(reviewPush(root, options.remote, options.branch).fingerprint, options.expect);
      // Push the reviewed object id, never a moving HEAD or an unreviewed branch.
      return git(root, ['push', '--porcelain', '--', preview.remote, `${preview.head}:refs/heads/${preview.branch}`], { hooks });
    });
    console.log(JSON.stringify({ mode: 'applied', command, result: scrub(result.trim()) }, null, 2));
    return;
  }
  throw new Error(`Unknown GitHub helper command: ${command}`);
}

direct(import.meta.url, main);

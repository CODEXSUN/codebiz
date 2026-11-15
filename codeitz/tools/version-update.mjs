#!/usr/bin/env node
import fs from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { applyReviewedEdits, previewEdits, resolveRoot, rollbackReviewedEdits, safePath, stat } from '../lib/engine.mjs';
import { allow, direct, parse, requireReview, singleLine } from './lib/cli.mjs';

const defaultRoot = fileURLToPath(new URL('../', import.meta.url));
const help = `Codeitz version tools — one package root at a time

  node codeitz/tools/version-update.mjs show [--root <package-root>]
  node codeitz/tools/version-update.mjs check [--root <package-root>]
  node codeitz/tools/version-update.mjs bump --level patch --title <title> [--root <root>]
  node codeitz/tools/version-update.mjs set --version 1.2.3 --title <title> [--root <root>]
  node codeitz/tools/version-update.mjs rollback --run <id> [--root <root>]

Writes preview by default. Repeat with --apply --expect <fingerprint> to apply.
Options: --level patch|minor|major; --changelog <relative-path>; --date YYYY-MM-DD;
--dry-run. Default root: Codeitz itself. Default date timezone: Asia/Kolkata.
Updates only package.json, an existing npm v2/v3 lock root, an existing app
manifest version, and the selected changelog. No workspace traversal, dependency
range rewrite, install, database migration, Git operation, tag or publish.
`;

export function parseVersion(value) {
  if (typeof value !== 'string' || !/^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(value)) throw new Error(`Expected stable major.minor.patch version: ${value}`);
  const parts = value.split('.').map(Number);
  if (!parts.every(Number.isSafeInteger)) throw new Error('Version components exceed the safe integer range.');
  return parts;
}

export function nextVersion(current, level = 'patch') {
  const parts = parseVersion(current);
  const index = ['major', 'minor', 'patch'].indexOf(level);
  if (index === -1) throw new Error('Level must be patch, minor, or major.');
  parts[index] += 1;
  for (let position = index + 1; position < 3; position++) parts[position] = 0;
  const next = parts.join('.');
  parseVersion(next);
  return next;
}

function isGreater(next, current) {
  const a = parseVersion(next);
  const b = parseVersion(current);
  for (let index = 0; index < 3; index++) if (a[index] !== b[index]) return a[index] > b[index];
  return false;
}

const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

async function read(root, relative, required = true) {
  const target = await safePath(root, relative);
  const entry = await stat(target);
  if (!entry) {
    if (required) throw new Error(`Missing ${relative}`);
    return null;
  }
  if (!entry.isFile() || entry.nlink > 1) throw new Error(`Expected an unlinked regular file: ${relative}`);
  return fs.readFile(target, 'utf8');
}

export async function inspectPackage(value) {
  const root = await resolveRoot(value);
  const pkg = JSON.parse(await read(root, 'package.json'));
  if (!pkg || typeof pkg !== 'object' || Array.isArray(pkg)) throw new Error('Invalid package metadata.');
  parseVersion(pkg.version);
  if (await stat(await safePath(root, 'npm-shrinkwrap.json'))) throw new Error('npm-shrinkwrap.json is not supported; do not leave authoritative lock metadata out of sync.');
  const lockRaw = await read(root, 'package-lock.json', false);
  const appRaw = await read(root, 'app.manifest.json', false);
  const lock = lockRaw === null ? null : JSON.parse(lockRaw);
  const app = appRaw === null ? null : JSON.parse(appRaw);
  if (lockRaw !== null && (!lock || typeof lock !== 'object' || Array.isArray(lock))) throw new Error('Invalid npm lock metadata.');
  if (appRaw !== null && (!app || typeof app !== 'object' || Array.isArray(app))) throw new Error('Invalid app manifest metadata.');
  if (lock) {
    if (![2, 3].includes(lock.lockfileVersion) || !lock.packages?.['']) throw new Error('Only npm lockfileVersion 2/3 with root metadata is supported.');
    if (lock.version !== pkg.version || lock.packages[''].version !== pkg.version) throw new Error('Package and lock root versions disagree; resolve this before updating.');
    if ((lock.name && pkg.name !== lock.name) || (lock.packages[''].name && lock.packages[''].name !== pkg.name)) throw new Error('Package and lock root names disagree.');
  }
  if (app && (app.schemaVersion !== 1 || app.version !== pkg.version)) throw new Error('App manifest is incompatible or disagrees with package version.');
  return { root, pkg, lock, app };
}

export function localDate(now = new Date()) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat('en', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).map((entry) => [entry.type, entry.value]));
  return `${parts.year}-${parts.month}-${parts.day}`;
}

function validDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) throw new Error('Date must be a valid YYYY-MM-DD value.');
  return value;
}

export async function prepareVersion(rootValue, options) {
  const { root, pkg, lock, app } = await inspectPackage(rootValue);
  const target = options.version ?? nextVersion(pkg.version, options.level ?? 'patch');
  if (!isGreater(target, pkg.version)) throw new Error('The new version must be greater than the current version.');
  const title = singleLine(options.title, 'Version title');
  const date = validDate(options.date ?? localDate());
  const changelogPath = options.changelog ?? ((await stat(await safePath(root, 'docs/changelog.md'))) ? 'docs/changelog.md' : 'CHANGELOG.md');
  if (['package.json', 'package-lock.json', 'app.manifest.json'].includes(changelogPath.toLowerCase())) throw new Error('Changelog cannot replace package metadata.');
  if (!changelogPath.endsWith('.md')) throw new Error('Changelog must be a relative Markdown file.');
  const existing = await read(root, changelogPath, false) ?? '# Changelog\n\nLocal version preparation history. Entries do not imply publication or deployment.\n';
  const versionHeading = /^##\s+v?\d+\.\d+\.\d+\b.*$/m;
  if (new RegExp(`^##\\s+v?${target.replaceAll('.', '\\.')}\\b`, 'm').test(existing)) throw new Error('Changelog already contains this version.');
  const section = `## v${target} — ${date}\n\n- ${title}\n- Prepared version ${pkg.version} → ${target} locally; no tag, publication, or deployment performed.\n\n`;
  const versionIndex = existing.search(versionHeading);
  const footerIndex = existing.search(/^\[Documentation home\]/m);
  const insertAt = versionIndex >= 0 ? versionIndex : footerIndex >= 0 ? footerIndex : existing.length;
  const prefix = existing.slice(0, insertAt);
  const changelog = `${prefix}${prefix.endsWith('\n\n') ? '' : prefix.endsWith('\n') ? '\n' : '\n\n'}${section}${existing.slice(insertAt)}`;
  const changes = [
    { path: 'package.json', content: json({ ...pkg, version: target }) },
    { path: changelogPath, content: changelog },
  ];
  if (lock) {
    lock.version = target;
    lock.packages[''].version = target;
    changes.push({ path: 'package-lock.json', content: json(lock) });
  }
  if (app) changes.push({ path: 'app.manifest.json', content: json({ ...app, version: target }) });
  const preview = await previewEdits(root, changes);
  return { ...preview, currentVersion: pkg.version, nextVersion: target, title, date, changes };
}

export async function main(argv = process.argv.slice(2)) {
  const { command, options } = parse(argv, {
    values: ['root', 'level', 'version', 'title', 'date', 'changelog', 'expect', 'run'], flags: ['apply', 'dry-run'],
  });
  if (['help', '--help', '-h'].includes(command)) { console.log(help); return; }
  const root = options.root ?? defaultRoot;
  if (['show', 'check'].includes(command)) {
    allow(options, ['root']);
    const result = await inspectPackage(root);
    console.log(json({ root: result.root, name: result.pkg.name ?? null, version: result.pkg.version,
      lockfile: Boolean(result.lock), appManifest: Boolean(result.app), consistent: true }));
    return;
  }
  if (command === 'rollback') {
    allow(options, ['root', 'run', 'apply', 'dry-run', 'expect']);
    const preview = await rollbackReviewedEdits(root, options.run);
    if (options.apply) requireReview(preview.fingerprint, options.expect);
    console.log(json(options.apply ? await rollbackReviewedEdits(root, options.run, options.expect) : preview));
    return;
  }
  if (!['bump', 'set'].includes(command)) throw new Error(`Unknown version command: ${command}`);
  allow(options, ['root', command === 'bump' ? 'level' : 'version', 'title', 'date', 'changelog', 'apply', 'dry-run', 'expect']);
  if (command === 'set' && !options.version) throw new Error('set requires --version.');
  const preview = await prepareVersion(root, options);
  const result = { mode: 'dry-run', root: preview.root, currentVersion: preview.currentVersion,
    nextVersion: preview.nextVersion, title: preview.title, date: preview.date, fingerprint: preview.fingerprint,
    files: preview.files.map(({ path: filePath, beforeHash, afterHash, content }) => ({ path: filePath, beforeHash, afterHash, proposedContent: content })) };
  if (options.apply) {
    requireReview(preview.fingerprint, options.expect);
    console.log(json({ ...result, mode: 'applied', ...await applyReviewedEdits(preview.root, preview.changes, options.expect) }));
  } else console.log(json(result));
}

direct(import.meta.url, main);

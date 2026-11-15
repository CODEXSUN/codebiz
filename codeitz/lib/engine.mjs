import { createHash, randomUUID } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';

export const hash = (content) => createHash('sha256').update(content).digest('hex');
const emptyState = () => ({ schemaVersion: 1, instances: {}, files: {} });
const isObject = (value) => value && typeof value === 'object' && !Array.isArray(value);
const statePath = '.codeitz/state.json';

export async function stat(filePath) {
  try { return await fs.lstat(filePath); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}

export function validateRelative(value, internal = false) {
  if (typeof value !== 'string' || !value || value.includes('\\') || value.includes(':') || value.includes('\0') || path.posix.isAbsolute(value)) {
    throw new Error(`Unsafe path: ${value}`);
  }
  const parts = value.split('/');
  if (parts.some((part) => !part || part === '.' || part === '..' || part.trim() !== part || part.endsWith('.'))) {
    throw new Error(`Unsafe path: ${value}`);
  }
  if (parts.some((part) => ['.git', 'node_modules'].includes(part.toLowerCase()) || (!internal && part.toLowerCase() === '.codeitz'))) {
    throw new Error(`Reserved path: ${value}`);
  }
  return value;
}

export async function resolveRoot(value) {
  const root = path.resolve(value);
  let current = path.parse(root).root;
  for (const segment of root.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, segment);
    const entry = await stat(current);
    if (!entry || !entry.isDirectory() || entry.isSymbolicLink()) throw new Error(`Root must be an existing directory without symlink ancestors: ${current}`);
  }
  return root;
}

export async function safePath(root, relative, internal = false) {
  validateRelative(relative, internal);
  let current = root;
  const parts = relative.split('/');
  for (let index = 0; index < parts.length; index++) {
    current = path.join(current, parts[index]);
    const entry = await stat(current);
    if (entry?.isSymbolicLink()) throw new Error(`Symlink paths are not supported: ${relative}`);
    if (entry && index < parts.length - 1 && !entry.isDirectory()) throw new Error(`Parent is not a directory: ${relative}`);
  }
  return current;
}

async function readRegular(root, relative, internal = false) {
  const target = await safePath(root, relative, internal);
  const entry = await stat(target);
  if (!entry) return null;
  if (!entry.isFile()) throw new Error(`Expected a regular file: ${relative}`);
  if (entry.nlink > 1) throw new Error(`Hard-linked files are not supported: ${relative}`);
  return { content: await fs.readFile(target, 'utf8'), mode: entry.mode & 0o777 };
}

export async function readState(root) {
  const source = await readRegular(root, statePath, true);
  if (!source) return { state: emptyState(), raw: null };
  const state = JSON.parse(source.content);
  if (state.schemaVersion !== 1 || !isObject(state.instances) || !isObject(state.files)) throw new Error('Unsupported or corrupt Codeitz state.');
  for (const [filePath, entry] of Object.entries(state.files)) {
    validateRelative(filePath);
    if (!isObject(entry) || typeof entry.owner !== 'string' || !/^[a-f0-9]{64}$/.test(entry.hash)) throw new Error('Invalid managed file record.');
  }
  for (const [id, instance] of Object.entries(state.instances)) {
    if (!isObject(instance) || instance.id !== id || typeof instance.generator !== 'string' || !isObject(instance.options)) throw new Error('Invalid generator instance record.');
  }
  return { state, raw: source.content };
}

function allDirectories(plan) {
  const directories = new Set();
  const add = (value) => {
    while (value && value !== '.') {
      validateRelative(value);
      directories.add(value);
      value = path.posix.dirname(value);
    }
  };
  plan.directories.forEach(add);
  plan.files.forEach((file) => add(path.posix.dirname(file.path)));
  return [...directories].sort((a, b) => a.split('/').length - b.split('/').length || a.localeCompare(b));
}

export async function inspect(rootValue, plan, { upgrade = false } = {}) {
  const root = await resolveRoot(rootValue);
  const { state, raw } = await readState(root);
  const directories = allDirectories(plan);
  const targets = new Map();
  for (const relative of [...directories, ...plan.files.map((file) => file.path)]) {
    validateRelative(relative);
    const folded = relative.toLowerCase();
    if (targets.has(folded) && targets.get(folded) !== relative) throw new Error(`Case-colliding paths: ${relative}`);
    targets.set(folded, relative);
  }
  const fileNames = new Set();
  const instanceIds = new Set(plan.instances.map((instance) => instance.id));
  for (const file of plan.files) {
    if (typeof file.content !== 'string' || !instanceIds.has(file.owner) || fileNames.has(file.path) || directories.includes(file.path)) throw new Error(`Conflicting template file: ${file.path}`);
    fileNames.add(file.path);
  }
  const actions = [];
  for (const relative of directories) {
    const target = await safePath(root, relative);
    const entry = await stat(target);
    if (entry && !entry.isDirectory()) throw new Error(`Expected a directory: ${relative}`);
    actions.push({ type: entry ? 'keep-directory' : 'create-directory', path: relative });
  }
  for (const file of plan.files) {
    const existing = await readRegular(root, file.path);
    const previous = state.files[file.path];
    const nextHash = hash(file.content);
    let type = 'create-file';
    let reason;
    if (previous && previous.owner !== file.owner) {
      type = 'conflict'; reason = 'Owned by a different generator.';
    } else if (existing) {
      const currentHash = hash(existing.content);
      if (currentHash === nextHash && (!previous || currentHash === previous.hash)) {
        type = previous ? 'unchanged-file' : 'keep-unmanaged-file';
      } else if (!previous || currentHash !== previous.hash) {
        type = 'conflict'; reason = 'Existing or locally edited file is preserved.';
      } else if (!upgrade) {
        type = 'conflict'; reason = 'Template changed; review the upgrade command.';
      } else { type = 'update-file'; }
    } else if (previous) {
      type = 'conflict'; reason = 'Managed file was deleted locally; it will not be recreated.';
    }
    actions.push({ type, path: file.path, reason, beforeHash: existing ? hash(existing.content) : null,
      afterHash: nextHash, content: file.content, owner: file.owner, mode: existing?.mode ?? 0o644 });
  }
  return { root, plan, state, stateRaw: raw, actions, conflicts: actions.filter((action) => action.type === 'conflict') };
}

async function makeInternalDirectory(root, relative) {
  const parts = relative.split('/');
  for (let index = 1; index <= parts.length; index++) {
    const target = await safePath(root, parts.slice(0, index).join('/'), true);
    const entry = await stat(target);
    if (entry && !entry.isDirectory()) throw new Error(`Expected internal directory: ${target}`);
    if (!entry) await fs.mkdir(target, { mode: 0o700 });
  }
}

async function writeAtomic(root, relative, content, mode = 0o600) {
  const target = await safePath(root, relative, true);
  const temporary = `${relative}.tmp-${randomUUID()}`;
  const tempPath = await safePath(root, temporary, true);
  try {
    await fs.writeFile(tempPath, content, { flag: 'wx', mode });
    await safePath(root, relative, true);
    await fs.rename(tempPath, target);
  } finally { await fs.rm(tempPath, { force: true }); }
}

async function createAtomic(root, relative, content, mode) {
  const target = await safePath(root, relative);
  const temporary = `${relative}.tmp-${randomUUID()}`;
  const tempPath = await safePath(root, temporary);
  try {
    await fs.writeFile(tempPath, content, { flag: 'wx', mode });
    await safePath(root, relative);
    // An exclusive link publishes a complete file without replacing a raced-in target.
    await fs.link(tempPath, target);
  } finally { await fs.rm(tempPath, { force: true }); }
}

async function withLock(root, operation) {
  await makeInternalDirectory(root, '.codeitz');
  const lockPath = await safePath(root, '.codeitz/lock', true);
  try { await fs.mkdir(lockPath, { mode: 0o700 }); }
  catch (error) { if (error.code === 'EEXIST') throw new Error('Codeitz is locked. Check for another run; do not remove an active lock.'); throw error; }
  try { return await operation(); }
  finally { await fs.rmdir(lockPath); }
}

async function verifyUnchanged(root, action) {
  const source = await readRegular(root, action.path);
  if ((source ? hash(source.content) : null) !== action.beforeHash) throw new Error(`File changed during planning: ${action.path}`);
}

export async function apply(rootValue, plan, options = {}) {
  const root = await resolveRoot(rootValue);
  // Preflight before creating metadata, then repeat under the cooperative lock.
  const initial = await inspect(root, plan, options);
  if (initial.conflicts.length) throw new Error(`Conflicts prevent all changes: ${initial.conflicts.map((entry) => entry.path).join(', ')}`);
  return withLock(root, async () => {
    const preview = await inspect(root, plan, options);
    if (preview.conflicts.length) throw new Error('Conflicts appeared while waiting for the lock.');
    const state = structuredClone(preview.state);
    for (const instance of plan.instances) state.instances[instance.id] = { ...instance, templateVersion: plan.templateVersion };
    const changes = preview.actions.filter((entry) => ['create-file', 'update-file'].includes(entry.type));
    for (const entry of changes) state.files[entry.path] = { owner: entry.owner, hash: entry.afterHash };
    const nextRaw = `${JSON.stringify(state, null, 2)}\n`;
    const newDirectories = preview.actions.filter((entry) => entry.type === 'create-directory');
    if (!changes.length && !newDirectories.length && nextRaw === preview.stateRaw) return { changed: false };
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const runPath = `.codeitz/runs/${id}`;
    await makeInternalDirectory(root, `${runPath}/backups`);
    const journal = { schemaVersion: 1, id, root, status: 'prepared', stateBefore: preview.stateRaw,
      stateAfterHash: hash(nextRaw), createdDirectories: [], files: [] };
    for (const [index, entry] of changes.entries()) {
      await verifyUnchanged(root, entry);
      const backup = entry.beforeHash ? `${runPath}/backups/${index}` : null;
      if (backup) {
        const source = await readRegular(root, entry.path);
        await fs.writeFile(await safePath(root, backup, true), source.content, { flag: 'wx', mode: 0o600 });
      }
      journal.files.push({ path: entry.path, beforeHash: entry.beforeHash, afterHash: entry.afterHash, backup, mode: entry.mode });
    }
    await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
    const written = [];
    let stateWritten = false;
    try {
      for (const entry of newDirectories) {
        await fs.mkdir(await safePath(root, entry.path));
        journal.createdDirectories.push(entry.path);
        await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
      }
      for (const entry of changes) {
        await verifyUnchanged(root, entry);
        if (entry.type === 'create-file') {
          await createAtomic(root, entry.path, entry.content, entry.mode);
        } else { await writeAtomic(root, entry.path, entry.content, entry.mode); }
        written.push(journal.files.find((file) => file.path === entry.path));
      }
      if ((await readState(root)).raw !== preview.stateRaw) throw new Error('State changed during application.');
      await writeAtomic(root, statePath, nextRaw);
      stateWritten = true;
      journal.status = 'applied';
      await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
      return { changed: true, runId: id, journal: `${runPath}/journal.json` };
    } catch (error) {
      try {
        await restoreFiles(root, written);
        if (stateWritten) await restoreState(root, preview.stateRaw);
        await removeEmptyDirectories(root, journal.createdDirectories);
        journal.status = 'reverted';
      } catch (recoveryError) {
        journal.status = 'recovery-required';
        error.message += ` Recovery incomplete: ${recoveryError.message}. Inspect ${runPath}/journal.json.`;
      }
      await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
      throw error;
    }
  });
}

async function restoreFiles(root, files) {
  for (const entry of [...files].reverse()) {
    const source = await readRegular(root, entry.path);
    if (!source && !entry.beforeHash) continue;
    if (!source || hash(source.content) !== entry.afterHash) throw new Error(`Refusing to replace changed file: ${entry.path}`);
    if (entry.backup) {
      const backup = await readRegular(root, entry.backup, true);
      if (!backup || hash(backup.content) !== entry.beforeHash) throw new Error(`Invalid backup for ${entry.path}`);
      await writeAtomic(root, entry.path, backup.content, entry.mode);
    } else { await fs.unlink(await safePath(root, entry.path)); }
  }
}

async function restoreState(root, raw) {
  if (raw === null) await fs.rm(await safePath(root, statePath, true), { force: true });
  else await writeAtomic(root, statePath, raw);
}

async function removeEmptyDirectories(root, directories) {
  for (const relative of [...directories].reverse()) {
    try { await fs.rmdir(await safePath(root, relative)); }
    catch (error) { if (!['ENOENT', 'ENOTEMPTY', 'EEXIST'].includes(error.code)) throw error; }
  }
}

export async function rollback(rootValue, id, { apply: shouldApply = false } = {}) {
  if (typeof id !== 'string' || !/^[0-9TZ-]+-[a-f0-9]{8}$/.test(id)) throw new Error('Invalid run id.');
  const root = await resolveRoot(rootValue);
  const inspectRun = async () => {
    const relative = `.codeitz/runs/${id}/journal.json`;
    const source = await readRegular(root, relative, true);
    if (!source) throw new Error(`Run not found: ${id}`);
    const journal = JSON.parse(source.content);
    if (journal.schemaVersion !== 1 || journal.id !== id || journal.root !== root || journal.status !== 'applied' || !Array.isArray(journal.files) || !Array.isArray(journal.createdDirectories)) throw new Error('Run is not an applied, compatible transaction.');
    const state = await readState(root);
    if (state.raw === null || hash(state.raw) !== journal.stateAfterHash) throw new Error('Later state changes prevent rollback. Roll back later runs first.');
    for (const entry of journal.files) {
      const current = await readRegular(root, entry.path);
      if (!current || hash(current.content) !== entry.afterHash) throw new Error(`Edited or missing file prevents rollback: ${entry.path}`);
      if (entry.backup) {
        if (!entry.backup.startsWith(`.codeitz/runs/${id}/backups/`)) throw new Error('Backup is outside this run.');
        const backup = await readRegular(root, entry.backup, true);
        if (!backup || hash(backup.content) !== entry.beforeHash) throw new Error(`Invalid backup: ${entry.path}`);
      }
    }
    for (const relative of journal.createdDirectories) await safePath(root, relative);
    return { journal, relative };
  };
  const preview = await inspectRun();
  if (!shouldApply) return { changed: false, files: preview.journal.files.map((entry) => entry.path), directories: preview.journal.createdDirectories };
  return withLock(root, async () => {
    const { journal, relative } = await inspectRun();
    await restoreFiles(root, journal.files);
    await restoreState(root, journal.stateBefore);
    await removeEmptyDirectories(root, journal.createdDirectories);
    journal.status = 'rolled-back';
    await writeAtomic(root, relative, `${JSON.stringify(journal, null, 2)}\n`);
    return { changed: true, runId: id };
  });
}

// Explicit maintenance edits are reviewed by hash, not adopted by generator state.
// Reuse the same path checks, cooperative lock, atomic writes and recovery helpers.
export async function previewEdits(rootValue, changes) {
  const root = await resolveRoot(rootValue);
  const seen = new Set();
  const files = [];
  for (const change of changes) {
    validateRelative(change.path);
    if (seen.has(change.path.toLowerCase()) || typeof change.content !== 'string') throw new Error(`Invalid maintenance target: ${change.path}`);
    seen.add(change.path.toLowerCase());
    const source = await readRegular(root, change.path);
    const beforeHash = source ? hash(source.content) : null;
    if (beforeHash === hash(change.content)) continue;
    files.push({ path: change.path, content: change.content, beforeHash,
      afterHash: hash(change.content), mode: source?.mode ?? 0o644 });
  }
  files.sort((a, b) => a.path.localeCompare(b.path));
  return { root, files, fingerprint: hash(JSON.stringify({ root, files })) };
}

export async function applyReviewedEdits(rootValue, changes, expected) {
  const initial = await previewEdits(rootValue, changes);
  if (!expected || expected !== initial.fingerprint) throw new Error('Missing or stale maintenance fingerprint. Preview again.');
  return withLock(initial.root, async () => {
    const preview = await previewEdits(initial.root, changes);
    if (preview.fingerprint !== expected) throw new Error('Maintenance targets changed after preview.');
    if (!preview.files.length) return { changed: false };
    const root = preview.root;
    const id = `${new Date().toISOString().replace(/[:.]/g, '-')}-${randomUUID().slice(0, 8)}`;
    const runPath = `.codeitz/tool-runs/${id}`;
    await makeInternalDirectory(root, `${runPath}/backups`);
    const journal = { schemaVersion: 1, id, root, status: 'prepared', files: [], createdDirectories: [] };
    for (const [index, entry] of preview.files.entries()) {
      await verifyUnchanged(root, entry);
      const backup = entry.beforeHash ? `${runPath}/backups/${index}` : null;
      if (backup) {
        const source = await readRegular(root, entry.path);
        await fs.writeFile(await safePath(root, backup, true), source.content, { flag: 'wx', mode: 0o600 });
      }
      journal.files.push({ path: entry.path, beforeHash: entry.beforeHash, afterHash: entry.afterHash, mode: entry.mode, backup });
    }
    await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
    const written = [];
    try {
      const directories = allDirectories({ directories: [], files: preview.files });
      for (const relative of directories) {
        const target = await safePath(root, relative);
        const entry = await stat(target);
        if (entry && !entry.isDirectory()) throw new Error(`Expected directory: ${relative}`);
        if (!entry) {
          await fs.mkdir(target);
          journal.createdDirectories.push(relative);
          await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
        }
      }
      for (const entry of preview.files) {
        await verifyUnchanged(root, entry);
        if (entry.beforeHash) await writeAtomic(root, entry.path, entry.content, entry.mode);
        else await createAtomic(root, entry.path, entry.content, entry.mode);
        written.push(journal.files.find((file) => file.path === entry.path));
      }
      journal.status = 'applied';
      await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
      return { changed: true, runId: id, journal: `${runPath}/journal.json` };
    } catch (error) {
      try {
        await restoreFiles(root, written);
        await removeEmptyDirectories(root, journal.createdDirectories);
        journal.status = 'reverted';
      } catch (recoveryError) {
        journal.status = 'recovery-required';
        error.message += ` Recovery incomplete: ${recoveryError.message}. Inspect ${runPath}/journal.json.`;
      }
      await writeAtomic(root, `${runPath}/journal.json`, `${JSON.stringify(journal, null, 2)}\n`);
      throw error;
    }
  });
}

export async function rollbackReviewedEdits(rootValue, id, expected) {
  if (typeof id !== 'string' || !/^[0-9TZ-]+-[a-f0-9]{8}$/.test(id)) throw new Error('Invalid maintenance run id.');
  const root = await resolveRoot(rootValue);
  const review = async () => {
    const relative = `.codeitz/tool-runs/${id}/journal.json`;
    const source = await readRegular(root, relative, true);
    if (!source) throw new Error('Maintenance run was not found.');
    const journal = JSON.parse(source.content);
    if (journal.schemaVersion !== 1 || journal.id !== id || journal.root !== root || journal.status !== 'applied' || !Array.isArray(journal.files) || !Array.isArray(journal.createdDirectories)) {
      throw new Error('Maintenance run is not an applied, compatible transaction.');
    }
    for (const entry of journal.files) {
      const current = await readRegular(root, entry.path);
      if (!current || hash(current.content) !== entry.afterHash) throw new Error(`Later edits prevent rollback: ${entry.path}`);
      if (entry.backup) {
        if (!entry.backup.startsWith(`.codeitz/tool-runs/${id}/backups/`)) throw new Error('Backup is outside this maintenance run.');
        const backup = await readRegular(root, entry.backup, true);
        if (!backup || hash(backup.content) !== entry.beforeHash) throw new Error(`Invalid maintenance backup: ${entry.path}`);
      }
    }
    for (const relative of journal.createdDirectories) await safePath(root, relative);
    return { journal, relative, fingerprint: hash(JSON.stringify({ root, id, journalHash: hash(source.content) })) };
  };
  const preview = await review();
  if (expected === undefined) return { mode: 'dry-run', fingerprint: preview.fingerprint, paths: preview.journal.files.map((entry) => entry.path) };
  if (expected !== preview.fingerprint) throw new Error('Stale rollback fingerprint. Preview again.');
  return withLock(root, async () => {
    const current = await review();
    if (current.fingerprint !== expected) throw new Error('Maintenance journal changed.');
    await restoreFiles(root, current.journal.files);
    await removeEmptyDirectories(root, current.journal.createdDirectories);
    current.journal.status = 'rolled-back';
    await writeAtomic(root, current.relative, `${JSON.stringify(current.journal, null, 2)}\n`);
    return { mode: 'applied', runId: id };
  });
}

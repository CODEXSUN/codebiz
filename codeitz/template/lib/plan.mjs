import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const templateVersion = '1.0.0';
export const json = (value) => `${JSON.stringify(value, null, 2)}\n`;

export function name(value, label = 'name') {
  if (typeof value !== 'string' || !/^[a-z][a-z0-9]*(?:-[a-z0-9]+)*$/.test(value) || value.length > 64) {
    throw new Error(`${label} must be lowercase kebab-case, start with a letter, and have at most 64 characters.`);
  }
  return value;
}

export function plan(generator, options, directories = [], contents = {}) {
  const id = `${generator}:${Object.values(options).join(':') || 'workspace'}`;
  return {
    schemaVersion: 1,
    templateVersion,
    instances: [{ id, generator, options }],
    directories: [...new Set(directories)].sort(),
    files: Object.entries(contents).map(([filePath, content]) => ({ path: filePath, content, owner: id })),
  };
}

export function merge(plans) {
  const result = { schemaVersion: 1, templateVersion, instances: [], directories: [], files: [] };
  const files = new Map();
  for (const entry of plans) {
    result.instances.push(...entry.instances);
    result.directories.push(...entry.directories);
    for (const file of entry.files) {
      if (files.has(file.path)) throw new Error(`Templates both own ${file.path}.`);
      files.set(file.path, file);
    }
  }
  result.directories = [...new Set(result.directories)].sort();
  result.files = [...files.values()].sort((a, b) => a.path.localeCompare(b.path));
  return result;
}

export function standalone(url, generator) {
  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url)) {
    import('../../runner.mjs')
      .then(({ main }) => main([generator, ...process.argv.slice(2)]))
      .catch((error) => { console.error(`Codeitz: ${error.message}`); process.exitCode = 1; });
  }
}

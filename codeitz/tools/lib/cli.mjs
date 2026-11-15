import path from 'node:path';
import { fileURLToPath } from 'node:url';

export function parse(argv, { values = [], flags = [] } = {}) {
  const command = argv[0] ?? 'help';
  const options = {};
  for (let index = 1; index < argv.length; index++) {
    const argument = argv[index];
    if (!argument.startsWith('--')) throw new Error(`Unexpected argument: ${argument}`);
    const key = argument.slice(2);
    if (Object.hasOwn(options, key)) throw new Error(`Duplicate option: ${argument}`);
    if (flags.includes(key)) options[key] = true;
    else if (values.includes(key)) {
      const value = argv[++index];
      if (!value || value.startsWith('--')) throw new Error(`${argument} needs a value.`);
      options[key] = value;
    } else throw new Error(`Unknown option: ${argument}`);
  }
  if (options.apply && options['dry-run']) throw new Error('Choose --apply or --dry-run.');
  return { command, options };
}

export function allow(options, keys) {
  for (const key of Object.keys(options)) if (!keys.includes(key)) throw new Error(`Unsupported option for this command: --${key}`);
}

export function requireReview(actual, expected) {
  if (!expected || !/^[a-f0-9]{64}$/.test(expected) || expected !== actual) {
    throw new Error('Missing or stale --expect fingerprint. Preview the exact operation again before applying.');
  }
}

export function singleLine(value, label, max = 200) {
  if (typeof value !== 'string' || !value.trim() || value.length > max || /[\x00-\x1f\x7f]/.test(value)) {
    throw new Error(`${label} must be one nonempty line of at most ${max} characters.`);
  }
  return value.trim();
}

export function direct(url, main) {
  if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(url)) {
    Promise.resolve().then(() => main()).catch((error) => {
      console.error(`Codeitz tools: ${error.message}`);
      process.exitCode = 1;
    });
  }
}

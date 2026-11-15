import { merge, name } from '../template/lib/plan.mjs';

export const generators = {
  workspace: { file: '../template/structure/folder.mjs', required: [] },
  app: { file: '../template/app.mjs', required: ['name'] },
  module: { file: '../template/module.mjs', required: ['app', 'name'] },
  event: { file: '../template/event.mjs', required: ['app', 'name'] },
  job: { file: '../template/job.mjs', required: ['app', 'name'] },
  worker: { file: '../template/worker.mjs', required: ['app'] },
  agent: { file: '../template/agent.mjs', required: ['app', 'name'] },
  package: { file: '../template/package.mjs', required: ['name'] },
};

export async function build(generator, options = {}) {
  const definition = generators[generator];
  if (!definition) throw new Error(`Unknown generator: ${generator}`);
  for (const key of definition.required) name(options[key], key);
  const allowed = new Set([...definition.required, ...(['workspace', 'package'].includes(generator) ? [] : ['standalone'])]);
  for (const key of Object.keys(options)) {
    if (!allowed.has(key)) throw new Error(`Unsupported ${generator} option: ${key}`);
  }
  if (options.standalone !== undefined && options.standalone !== true) throw new Error('standalone must be true when provided.');
  const template = await import(new URL(definition.file, import.meta.url));
  const result = template.build(options);
  if (options.standalone) {
    const app = options.app ?? options.name;
    const prefix = `apps/${app}/`;
    const rebase = (value) => {
      if (!value.startsWith(prefix)) throw new Error(`Cannot rebase ${value} into an app repository.`);
      return value.slice(prefix.length);
    };
    result.directories = result.directories.map(rebase);
    result.files = result.files.map((file) => ({ ...file, path: rebase(file.path), owner: `${file.owner}:standalone` }));
    result.instances = result.instances.map((instance) => ({ ...instance, id: `${instance.id}:standalone`, options: { ...instance.options, standalone: true } }));
  }
  return result;
}

export async function buildUpgrade(state) {
  return merge(await Promise.all(Object.values(state.instances).map((entry) => build(entry.generator, entry.options))));
}

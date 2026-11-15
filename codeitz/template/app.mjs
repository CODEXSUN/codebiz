import { appDirectories } from './lib/app-layout.mjs';
import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const app = name(options.name, 'app name');
  const base = `apps/${app}`;
  return plan('app', { name: app }, appDirectories(base), {
    [`${base}/package.json`]: json({ name: `@codebiz/${app}`, version: '0.1.0', private: true, type: 'module', engines: { node: '>=22' } }),
    [`${base}/app.manifest.json`]: json({ schemaVersion: 1, id: app, version: '0.1.0', maturity: 'scaffold',
      foundationContract: '1', permissions: [], publishes: [], consumes: [], capabilities: [] }),
    [`${base}/.gitignore`]: 'node_modules/\ndist/\ncoverage/\n.env\n.env.*\n!.env.example\n.codeitz/\n',
    [`${base}/README.md`]: `# ${app}\n\nIndependent app scaffold. No running API, identity, database, worker, or agent is implemented yet.\n\nOwn your dependencies, lockfile, contracts, migrations, tests, and release pipeline. Consume published foundation packages; never import sibling app source. Ports and secrets belong to validated runtime configuration.\n\nCodeitz creates metadata and folders only. Add real runtime commands and compatible dependency versions when implementation begins.\n`,
  });
}

await standalone(import.meta.url, 'app');

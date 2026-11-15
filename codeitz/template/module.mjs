import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const app = name(options.app, 'app');
  const module = name(options.name, 'module name');
  const base = `apps/${app}/api/src/modules/${module}`;
  return plan('module', { app, name: module }, [base, `apps/${app}/web/src/features/${module}`, `apps/${app}/tests/${module}`], {
    [`${base}/module.manifest.json`]: json({ schemaVersion: 1, app, id: module, maturity: 'scaffold', permissions: [], publicContracts: [] }),
    [`${base}/README.md`]: `# ${module}\n\nOwned by ${app}. Add routes, schemas, policies, services, and repositories only when behavior requires them. Keep app contracts outside implementation. Validate identity, tenant context, and operation permissions on the server.\n`,
  });
}

await standalone(import.meta.url, 'module');

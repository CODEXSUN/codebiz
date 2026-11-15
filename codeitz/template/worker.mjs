import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const app = name(options.app, 'app');
  const base = `apps/${app}/worker`;
  return plan('worker', { app }, [base, `apps/${app}/jobs`, `apps/${app}/tests/worker`], {
    [`${base}/worker.manifest.json`]: json({ schemaVersion: 1, app, maturity: 'scaffold', enabled: false,
      concurrency: 1, jobTypes: [], tenantContext: 'required' }),
  });
}

await standalone(import.meta.url, 'worker');

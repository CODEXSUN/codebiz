import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const app = name(options.app, 'app');
  const job = name(options.name, 'job name');
  const base = `apps/${app}/jobs/${job}`;
  return plan('job', { app, name: job }, [base, `apps/${app}/worker`, `apps/${app}/tests/jobs/${job}`], {
    [`${base}/job.manifest.json`]: json({ schemaVersion: 1, id: `${app}.${job}`, app, maturity: 'scaffold',
      enabled: false, requiresTenant: true, requiresIdempotencyKey: true, timeoutMs: 30000,
      maxAttempts: 3, permissions: [] }),
  });
}

await standalone(import.meta.url, 'job');

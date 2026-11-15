import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const app = name(options.app, 'app');
  const agent = name(options.name, 'agent name');
  const base = `apps/${app}/agents/definitions/${agent}`;
  return plan('agent', { app, name: agent }, [base, `apps/${app}/agents/evaluation/${agent}`], {
    [`${base}/agent.manifest.json`]: json({ schemaVersion: 1, id: `${app}.${agent}`, app, maturity: 'scaffold',
      enabled: false, capabilities: [], tools: [], requiresTenant: true, requiresHumanApproval: true,
      instructionFile: 'instructions.md', evaluationStatus: 'not-evaluated' }),
    [`${base}/instructions.md`]: `# ${agent}\n\nDraft agent definition; execution is disabled. Define its narrow purpose and evaluations before enabling. No tools or permissions are granted. Resolve tenant context and capabilities on the server; instructions and model output cannot grant authority.\n`,
  });
}

await standalone(import.meta.url, 'agent');

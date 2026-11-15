import { appDirectories } from '../lib/app-layout.mjs';
import { plan, standalone } from '../lib/plan.mjs';

export function build() {
  const directories = [];
  const add = (base, children) => children.forEach((child) => directories.push(`${base}/${child}`));
  add('framework', [
    'runtime', 'contracts', 'tenancy/context', 'tenancy/isolation',
    'security/authentication', 'security/authorization', 'security/service-identity', 'security/secret-resolvers',
    'database/connections', 'database/transactions', 'database/migrations',
    'observability/logging', 'observability/tracing', 'observability/metrics', 'testing', 'toolchain',
  ]);
  add('zetro', ['providers', 'contracts', 'context', 'structured-output', 'memory', 'guardrails', 'usage', 'tests', 'docs']);
  directories.push(...appDirectories('platform'), 'platform/client');
  add('platform/api/src/modules', [
    'tenants', 'domains', 'identity', 'memberships', 'access-control', 'app-catalog',
    'app-installations', 'service-discovery', 'app-gateway', 'provisioning', 'subscriptions',
    'resource-policies', 'agent-catalog', 'automation-runs', 'approvals', 'audit',
  ]);
  add('packages/ui', ['src/components', 'src/layouts', 'src/hooks', 'src/styles', 'src/tokens', 'stories', 'tests', 'docs']);
  add('packages/messaging', ['contracts', 'outbox', 'inbox', 'tests', 'docs']);
  add('workers/runtime', ['lifecycle', 'health', 'concurrency']);
  add('workers/queue', ['contracts', 'adapters', 'producers', 'consumers', 'scheduling', 'retries', 'dead-letter']);
  add('workers/agents', ['executors', 'sandbox-adapters', 'checkpoints', 'cancellation', 'recovery']);
  directories.push('workers/tests');
  add('automation', ['contracts', 'orchestration', 'workflows', 'triggers', 'evaluation/datasets', 'evaluation/scenarios', 'evaluation/scoring', 'tests', 'docs']);
  add('automation/agents', ['planning', 'development', 'review', 'testing', 'security', 'documentation', 'maintenance', 'release', 'operations']);
  add('mcp-governance', ['contracts', 'registry/servers', 'registry/tools', 'registry/resources', 'registry/prompts',
    'policies/tenancy', 'policies/identity', 'policies/capabilities', 'policies/delegation', 'policies/approvals',
    'policies/data-access', 'enforcement', 'approval-adapters', 'credential-resolvers', 'redaction', 'audit', 'adapters', 'tests', 'docs']);
  for (const app of ['database-manager', 'project-manager', 'reference-alpha', 'reference-beta']) {
    directories.push(...appDirectories(`apps/${app}`));
  }
  add('apps/database-manager/api/src/modules', ['inventory', 'provisioning', 'migrations', 'backups', 'restores', 'health']);
  add('apps/project-manager/api/src/modules', ['projects', 'repositories', 'environments', 'dependencies', 'builds', 'releases']);
  add('tooling', ['generators/app', 'generators/module', 'generators/worker', 'generators/agent', 'repository-manager',
    'manifest-validation', 'dependency-checks', 'compatibility-checks', 'dependency-updates', 'release']);
  add('environments', ['local', 'staging', 'production']);
  add('infrastructure', ['bootstrap', 'edge', 'database', 'secrets', 'messaging', 'workers/queue', 'workers/agents',
    'ai/model-gateway', 'ai/sandboxes', 'storage/artifacts', 'storage/files', 'observability', 'backup']);
  add('integration-tests', ['authentication', 'tenancy', 'domains', 'app-lifecycle', 'app-communication', 'job-processing',
    'agent-execution', 'automation', 'mcp-governance', 'compatibility', 'recovery', 'scaffold', 'independent-deployment']);
  add('docs', ['architecture', 'decisions', 'development', 'security', 'operations', 'runbooks']);
  directories.push('.github/workflows');
  return plan('workspace', {}, directories);
}

await standalone(import.meta.url, 'workspace');

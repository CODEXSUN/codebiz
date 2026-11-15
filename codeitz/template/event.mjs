import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const app = name(options.app, 'app');
  const event = name(options.name, 'event name');
  const eventType = `${app}.${event}.v1`;
  const base = `apps/${app}/contracts/events`;
  return plan('event', { app, name: event }, [base], {
    [`${base}/${event}.v1.schema.json`]: json({
      $schema: 'https://json-schema.org/draft/2020-12/schema', $id: `urn:codebiz:event:${eventType}`,
      title: eventType, type: 'object', additionalProperties: false,
      required: ['id', 'type', 'version', 'tenantId', 'sourceApp', 'occurredAt', 'correlationId', 'data'],
      properties: {
        id: { type: 'string', minLength: 1 }, type: { const: eventType }, version: { const: 1 },
        tenantId: { type: 'string', minLength: 1 }, sourceApp: { const: app },
        occurredAt: { type: 'string', format: 'date-time' }, correlationId: { type: 'string', minLength: 1 },
        data: { type: 'object', additionalProperties: false, properties: {} },
      },
      $comment: 'Scaffold: define data fields before publishing. Validate credentials and tenant context separately; this schema does not authorize delivery. Consumers must deduplicate by event id.',
    }),
  });
}

await standalone(import.meta.url, 'event');

export function appDirectories(base, { web = true, worker = true } = {}) {
  return [
    `${base}/api/src/bootstrap`, `${base}/api/src/modules`, `${base}/api/src/integrations`,
    ...(web ? [`${base}/web/src/app`, `${base}/web/src/features`] : []),
    ...(worker ? [`${base}/worker`, `${base}/jobs`] : []),
    `${base}/agents/definitions`, `${base}/agents/instructions`, `${base}/agents/tools`,
    `${base}/agents/evaluation`, `${base}/automations/workflows`, `${base}/automations/triggers`,
    `${base}/contracts`, `${base}/database/migrations`, `${base}/deployment`,
    `${base}/tests`, `${base}/docs`, `${base}/.github/workflows`,
  ];
}

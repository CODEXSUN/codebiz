import { json, name, plan, standalone } from './lib/plan.mjs';

export function build(options) {
  const packageName = name(options.name, 'package name');
  const base = `packages/${packageName}`;
  return plan('package', { name: packageName }, [`${base}/src`, `${base}/tests`, `${base}/docs`], {
    [`${base}/package.json`]: json({ name: `@codebiz/${packageName}`, version: '0.1.0', private: true,
      type: 'module', engines: { node: '>=22' } }),
    [`${base}/README.md`]: `# @codebiz/${packageName}\n\nShared package scaffold. Define a public API, tests, build outputs, and publication policy before removing private. Do not import child app implementations.\n`,
  });
}

await standalone(import.meta.url, 'package');

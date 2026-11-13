import { writeFileSync } from 'node:fs';

const environment = process.argv[2];
if (!['preview', 'prod'].includes(environment)) {
  throw new Error(`Unknown environment: ${environment}`);
}

const metadata = {
  environment,
  commit: process.env.GITHUB_SHA ?? 'local',
  ref: process.env.GITHUB_REF_NAME ?? 'local',
  deployedAt: new Date().toISOString(),
};

writeFileSync('dist/deployment.json', `${JSON.stringify(metadata, null, 2)}\n`);

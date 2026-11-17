import { mkdirSync, writeFileSync } from 'node:fs';

const environment = process.argv[2];
if (!['preview', 'prod'].includes(environment)) {
  throw new Error(`Unknown environment: ${environment}`);
}

const required = [
  'AUTH_DOMAIN',
  'AUTH_ISSUER',
  'AUTH_JWKS_URI',
  'AUTH_CLIENT_ID',
  'AUTH_LOGOUT_URI',
];
for (const name of required) {
  if (!process.env[name]) throw new Error(`Missing ${name}`);
}

const config = {
  environment,
  domain: process.env.AUTH_DOMAIN,
  issuer: process.env.AUTH_ISSUER,
  jwksUri: process.env.AUTH_JWKS_URI,
  clientId: process.env.AUTH_CLIENT_ID,
  logoutUri: process.env.AUTH_LOGOUT_URI,
};

mkdirSync('dist', { recursive: true });
writeFileSync('dist/auth-config.json', `${JSON.stringify(config, null, 2)}\n`);

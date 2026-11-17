import { Platform } from 'react-native';

import type { AuthConfig } from '@/auth/types';

const CONFIG_PATH = '/auth-config.json';

function normalizeDomain(value: string): string {
  return value
    .trim()
    .replace(/^https?:\/\//, '')
    .replace(/\/+$/, '');
}

function defaultLogoutUri(domain: string): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/`;
  }
  return `https://${domain}/`;
}

function normalizeConfig(raw: Partial<AuthConfig>): AuthConfig {
  if (!raw.domain || !raw.clientId || !raw.issuer) {
    throw new Error('Sign-in is not configured for this deployment.');
  }

  const domain = normalizeDomain(raw.domain);
  const issuer = raw.issuer.trim();
  return {
    environment: raw.environment?.trim() || 'preview',
    domain,
    issuer,
    jwksUri: raw.jwksUri?.trim() || `${issuer}/.well-known/jwks.json`,
    clientId: raw.clientId.trim(),
    logoutUri: raw.logoutUri?.trim() || defaultLogoutUri(domain),
  };
}

function configFromEnv(): AuthConfig | null {
  const domain = process.env.EXPO_PUBLIC_AUTH_DOMAIN;
  const clientId = process.env.EXPO_PUBLIC_AUTH_CLIENT_ID;
  if (!domain || !clientId) return null;

  const issuer = process.env.EXPO_PUBLIC_AUTH_ISSUER;
  return normalizeConfig({
    environment: process.env.EXPO_PUBLIC_AUTH_ENVIRONMENT || 'preview',
    domain,
    issuer:
      issuer ||
      `https://cognito-idp.${process.env.EXPO_PUBLIC_AUTH_REGION || 'us-east-2'}.amazonaws.com`,
    jwksUri: process.env.EXPO_PUBLIC_AUTH_JWKS_URI,
    clientId,
    logoutUri: process.env.EXPO_PUBLIC_AUTH_LOGOUT_URI,
  });
}

export async function loadAuthConfig(): Promise<AuthConfig> {
  const fromEnv = configFromEnv();
  if (fromEnv) return fromEnv;

  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    const response = await fetch(CONFIG_PATH, { cache: 'no-store' });
    if (!response.ok) {
      throw new Error('Sign-in is not configured for this deployment.');
    }
    try {
      return normalizeConfig((await response.json()) as Partial<AuthConfig>);
    } catch {
      throw new Error('Sign-in is not configured for this deployment.');
    }
  }

  throw new Error('Sign-in is not configured for this build.');
}

export function authEndpoints(config: AuthConfig) {
  return {
    authorizationEndpoint: `https://${config.domain}/oauth2/authorize`,
    tokenEndpoint: `https://${config.domain}/oauth2/token`,
    endSessionEndpoint: `https://${config.domain}/logout`,
  };
}

export function cognitoLogoutUrl(config: AuthConfig): string {
  const params = new URLSearchParams({
    client_id: config.clientId,
    logout_uri: config.logoutUri,
  });
  return `https://${config.domain}/logout?${params.toString()}`;
}

export function getRedirectUri(): string {
  if (Platform.OS === 'web' && typeof window !== 'undefined') {
    return `${window.location.origin}/auth/callback`;
  }
  return 'ironaltar://auth/callback';
}

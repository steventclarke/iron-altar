import { Platform } from 'react-native';

import type { AuthConfig, AuthIdentity } from '@/auth/types';

type IdTokenClaims = {
  sub?: string;
  iss?: string;
  aud?: string | string[];
  exp?: number;
  token_use?: string;
  email?: string;
  email_verified?: boolean | string;
  name?: string;
  picture?: string;
};

function decodeBase64Url(value: string): string {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/');
  const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, '=');
  const binary = atob(padded);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  if (typeof TextDecoder !== 'undefined') return new TextDecoder().decode(bytes);
  return decodeURIComponent(
    Array.from(bytes, (byte) => `%${byte.toString(16).padStart(2, '0')}`).join(''),
  );
}

export function decodeIdToken(idToken: string): IdTokenClaims {
  const payload = idToken.split('.')[1];
  if (!payload) throw new Error('The sign-in token is malformed.');
  try {
    return JSON.parse(decodeBase64Url(payload)) as IdTokenClaims;
  } catch {
    throw new Error('The sign-in token is malformed.');
  }
}

function audienceMatches(audience: string | string[] | undefined, clientId: string): boolean {
  if (Array.isArray(audience)) return audience.includes(clientId);
  return audience === clientId;
}

export function validateClaims(
  claims: IdTokenClaims,
  config: AuthConfig,
  now: number,
): AuthIdentity {
  if (!claims.sub) throw new Error('The sign-in token has no subject.');
  if (claims.iss !== config.issuer) throw new Error('The sign-in token issuer is not trusted.');
  if (!audienceMatches(claims.aud, config.clientId)) {
    throw new Error('The sign-in token was issued for another app.');
  }
  if (typeof claims.exp !== 'number' || claims.exp * 1000 <= now) {
    throw new Error('The sign-in token has expired.');
  }
  if (claims.token_use !== 'id') throw new Error('The sign-in token has the wrong type.');
  const emailVerified = claims.email_verified === true || claims.email_verified === 'true';

  return {
    sub: claims.sub,
    email: emailVerified ? (claims.email ?? null) : null,
    emailVerified,
    name: claims.name ?? null,
    picture: claims.picture ?? null,
  };
}

export async function verifyIdToken(idToken: string, config: AuthConfig): Promise<AuthIdentity> {
  const claims = decodeIdToken(idToken);
  const identity = validateClaims(claims, config, Date.now());

  if (Platform.OS === 'web') {
    try {
      const { createRemoteJWKSet, jwtVerify } = await import('jose');
      await jwtVerify(idToken, createRemoteJWKSet(new URL(config.jwksUri)), {
        issuer: config.issuer,
        audience: config.clientId,
      });
    } catch {
      throw new Error('Could not verify the sign-in token signature.');
    }
  }

  return identity;
}

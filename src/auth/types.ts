export type AuthIdentity = {
  sub: string;
  email: string | null;
  emailVerified: boolean;
  name: string | null;
  picture: string | null;
};

export type AuthSession = {
  identity: AuthIdentity;
  idToken: string;
  accessToken: string;
  refreshToken: string | null;
  expiresAt: number;
  environment: string;
};

export type AuthConfig = {
  environment: string;
  domain: string;
  issuer: string;
  jwksUri: string;
  clientId: string;
  logoutUri: string;
};

export type PendingAuth = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
  returnTo: string;
};

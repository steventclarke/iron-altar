# Google Sign-In (Optional)

Iron Altar can sign users in with Google through the platform's shared Cognito user pool.
Sign-in is **optional**: the app never gates training features, and no training data is
uploaded or synced. It adds a verified identity that the Profile screen can display.

Platform contract: `../stevenclarke-infrastructure/docs/google-sso-for-tenant-apps.md`.

## What the app owns

| Piece                                                           | Where                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| Public PKCE app client per environment                          | `infra/lib/static-site-stack.ts` (`GoogleSignInClient`) |
| Web callback/logout URLs and native `ironaltar://auth/callback` | Client `CallbackURLs` / `LogoutURLs`                    |
| Runtime config                                                  | `dist/auth-config.json`, written by the deploy workflow |
| OIDC flow, token validation, session                            | `src/auth/`                                             |
| `/login`, `/auth/callback`, `/logout` routes                    | `src/app/`                                              |
| CSP allowances                                                  | `SecurityHeadersPolicy` in the site stack               |

The platform owns the Cognito user pool, Google OAuth client, Hosted UI domain, and the
`/platform/auth/*` SSM parameters. Do not create a Google OAuth client or another pool.

## Platform values

Read at deploy time (never hardcode):

| SSM parameter                  | Used for                                               |
| ------------------------------ | ------------------------------------------------------ |
| `/platform/auth/user-pool-id`  | Importing the shared pool to create the app client     |
| `/platform/auth/domain`        | Hosted UI authorize/token/logout endpoints             |
| `/platform/auth/issuer`        | ID token `iss` validation                              |
| `/platform/auth/jwks-uri`      | Web signature verification                             |
| `/platform/auth/user-pool-arn` | Not used directly; the platform scopes the deploy role |

The app client ID is published as the `AuthClientId` CloudFormation output on
`iron-altar-<env>-site`. It is not written to SSM because the app deploy role only has
`ssm:GetParameter`; the workflow reads the stack output instead.

## Redirect URLs

| Surface | Environment               | Redirect URI                                                |
| ------- | ------------------------- | ----------------------------------------------------------- |
| Web     | prod                      | `https://iron-altar.stevenclarke.dev/auth/callback`         |
| Web     | preview                   | `https://iron-altar-preview.stevenclarke.dev/auth/callback` |
| Web     | local dev                 | `http://localhost:8081/auth/callback` (and `127.0.0.1`)     |
| Native  | development/release build | `ironaltar://auth/callback`                                 |
| Expo Go | —                         | unsupported; `exp://` hosts cannot be pre-registered        |

The preview client also carries the localhost and native URLs; the prod client carries the
prod web URL and the native scheme.

## Runtime configuration

Deployed web builds fetch `/auth-config.json` at runtime:

```json
{
  "environment": "preview",
  "domain": "stevenclarke.auth.us-east-2.amazoncognito.com",
  "issuer": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_x9yXbO0c5",
  "jwksUri": "https://cognito-idp.us-east-2.amazonaws.com/us-east-2_x9yXbO0c5/.well-known/jwks.json",
  "clientId": "<app client id>",
  "logoutUri": "https://iron-altar-preview.stevenclarke.dev/"
}
```

The preview and prod deploy workflows read `/platform/auth/*` and the site stack's
`AuthClientId`/`SiteUrl` outputs, then write `dist/auth-config.json` before syncing to S3.

### Local development

Use the preview client and set env vars in `.env.local` (Expo loads them automatically):

```bash
EXPO_PUBLIC_AUTH_ENVIRONMENT=preview
EXPO_PUBLIC_AUTH_DOMAIN=stevenclarke.auth.us-east-2.amazoncognito.com
EXPO_PUBLIC_AUTH_ISSUER=https://cognito-idp.us-east-2.amazonaws.com/<pool-id>
EXPO_PUBLIC_AUTH_JWKS_URI=https://cognito-idp.us-east-2.amazonaws.com/<pool-id>/.well-known/jwks.json
EXPO_PUBLIC_AUTH_CLIENT_ID=<preview app client id>
EXPO_PUBLIC_AUTH_LOGOUT_URI=http://localhost:8081/
```

Fetch the client ID after deploying the preview stack:

```bash
aws cloudformation describe-stacks --stack-name iron-altar-preview-site \
  --query "Stacks[0].Outputs[?OutputKey=='AuthClientId'].OutputValue" --output text
```

Native builds need the same `EXPO_PUBLIC_AUTH_*` values supplied by the build profile;
there is no runtime config fetch on native. Expo Go cannot complete native sign-in.

## Session behaviour

- **Web:** ID/access tokens are kept in memory only. A reload signs the app out of the
  session but the shared Cognito session persists, so signing in again usually skips the
  Google prompt. Refresh tokens are never written to `localStorage`.
- **Native:** tokens are stored in `expo-secure-store`; the app refreshes before expiry and
  restores the session on launch.
- **Sign-out:** clears the local session and redirects to the Cognito `/logout` endpoint
  with the app's `logout_uri` so the shared SSO session also ends.
- **Continue without signing in:** always available on `/login`, the callback screen, and
  the logout screen. No route or feature requires a session.

Web signature verification uses `jose` and the platform JWKS. Native P9 validates the ID
token claims (`iss`, `aud`, `exp`, `token_use`, `email_verified`) but not the RS256
signature because Hermes lacks WebCrypto; a backend or polyfill can tighten this later.

## CSP

CloudFront sends a CSP that allows:

- `script-src 'self'` and `style-src 'self' 'unsafe-inline'` (React Native Web styles)
- `connect-src` to the Hosted UI domain and `cognito-idp.us-east-2.amazonaws.com` (JWKS)
- `img-src` to `https://*.googleusercontent.com` for Google avatars
- `form-action` to the Hosted UI domain and `accounts.google.com`

## Troubleshooting

| Symptom                                                | Likely cause                                                                   |
| ------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `redirect_uri_mismatch` / `invalid_request` at Cognito | Callback URL differs from the client config (scheme, port, trailing slash).    |
| "Sign-in is not configured"                            | `auth-config.json` missing or `EXPO_PUBLIC_AUTH_*` unset.                      |
| State/verifier error after returning                   | Pending sign-in was cleared (new tab, private mode, app restart). Start again. |
| CSP blocks token/JWKS request                          | Hosted UI or Cognito region changed; update the CSP and redeploy.              |
| Google prompt appears repeatedly                       | Cognito session ended or cookies blocked; expected after sign-out.             |

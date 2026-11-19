# Google Sign-In and Landing Gate

Iron Altar can sign users in with Google through the platform's shared Cognito user pool.
Google sign-in is **optional**: anonymous access is always available, and no training data
is uploaded or synced. The app opens at `/welcome`; the user must choose Google or anonymous
before reaching app routes.

Platform contract: `../stevenclarke-infrastructure/docs/google-sso-for-tenant-apps.md`.

> **Shipped in Phase 9.1:** a `/welcome` landing gate replaces the optional in-app `/login`
> entry. Every app route is guarded until the user signs in with Google or chooses
> **Continue as anonymous**. Sign-out returns to the landing page. See
> [Landing gate](#landing-gate-phase-91) below.

## What the app owns

| Piece                                                           | Where                                                   |
| --------------------------------------------------------------- | ------------------------------------------------------- |
| Public PKCE app client per environment                          | `infra/lib/static-site-stack.ts` (`GoogleSignInClient`) |
| Web callback/logout URLs and native `ironaltar://auth/callback` | Client `CallbackURLs` / `LogoutURLs`                    |
| Runtime config                                                  | `dist/auth-config.json`, written by the deploy workflow |
| OIDC flow, token validation, session                            | `src/auth/`                                             |
| `/welcome` landing gate, `/auth/callback`, `/logout`            | `src/app/`                                              |
| Entry mode and anonymous marker                                 | `src/state/auth-store.ts`, `src/auth/storage.ts`        |
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

## Landing gate (Phase 9.1)

The app opens at `/welcome` on every cold load. The landing page offers exactly two choices:

- **Sign in with Google** starts the existing PKCE flow and returns to `/`.
- **Continue as anonymous** records a local anonymous entry and returns to `/`.

No app route is reachable until one of those choices is made. `/auth/callback` remains
reachable without an entry so the Google redirect can finish. Deep links and direct URLs to
protected screens redirect to `/welcome`; browser back to `/welcome` after entry redirects
home.

| Surface | Anonymous                                   | Google                                                                                                   |
| ------- | ------------------------------------------- | -------------------------------------------------------------------------------------------------------- |
| Web     | Persists in `localStorage` across reloads   | Tokens stay memory-only; a reload returns to `/welcome`, and signing in again reuses the Cognito session |
| Native  | Persists in SecureStore across relaunches   | Session restores from SecureStore                                                                        |
| Logout  | Clears the marker and returns to `/welcome` | Clears tokens, ends the Cognito session, and returns to `/welcome`                                       |

Anonymous is a local identity mode, not a separate database, profile, or sync state. The
Account panel shows **Anonymous** or the Google identity and offers sign-out; switching
modes requires signing out. The route guard uses Expo Router `Stack.Protected` with
`unstable_settings.anchor = 'welcome'` (SDK 58; `initialRouteName` is deprecated), and splash
stays visible until auth hydration completes.

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
- **Continue as anonymous:** the entry choice on `/welcome`, and also offered on the callback
  screen when sign-in fails. Google stays optional, but the entry choice is required.
- **Persistence:** anonymous survives reload/relaunch, native Google restores, and web Google
  returns to `/welcome` on reload because tokens remain memory-only.

Web signature verification uses `jose` and the platform JWKS. Native P9 validates the ID
token claims (`iss`, `aud`, `exp`, `token_use`, `email_verified`) but not the RS256
signature because Hermes lacks WebCrypto; a backend or polyfill can tighten this later.

The platform now maps both `email` and
`emailVerified: cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED` from Google, and the shared
user pool uses a mutable `email` attribute. Repeat federated sign-ins therefore no longer fail
with `"SIGN-IN FAILED user.email: Attribute cannot be updated."`. Adding a Google Cloud test
user fixes consent-screen access; it does not change the attribute mapping.

## CSP

CloudFront sends a CSP that allows:

- `script-src 'self'` and `style-src 'self' 'unsafe-inline'` (React Native Web styles)
- `connect-src` to the Hosted UI domain and `cognito-idp.us-east-2.amazonaws.com` (JWKS)
- `img-src` to `https://*.googleusercontent.com` for Google avatars
- `form-action` to the Hosted UI domain and `accounts.google.com`

## Google Cloud test users

The Google OAuth client is platform-owned: `279862640725-co9t4uufugkp8rklh4vatc63ve08scr1`.
Its prefix is the Google Cloud project number (`279862640725`). While the consent screen is
in **Testing**, only registered test users can sign in; untrusted accounts see an access
blocked / not-verified error.

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with the account that
   owns the platform project and select the project numbered `279862640725`.
2. Open **Google Auth Platform → Audience** (older UI: **APIs & Services → OAuth consent
   screen**).
3. Under **Test users**, add the exact Google account used to test Iron Altar.
4. Confirm the publishing status is **Testing** and the user type is **External**. If the
   user type is **Internal**, only Workspace-org accounts can sign in; switch to External or
   use an org account.
5. Do not create a second OAuth client or user pool; the platform owns both.

## Troubleshooting

| Symptom                                                     | Likely cause                                                                                    |
| ----------------------------------------------------------- | ----------------------------------------------------------------------------------------------- |
| `"SIGN-IN FAILED user.email: Attribute cannot be updated."` | Stale platform pool with immutable `email`; redeploy the shared `AuthStack` with mutable email. |
| `redirect_uri_mismatch` / `invalid_request` at Cognito      | Callback URL differs from the client config (scheme, port, trailing slash).                     |
| "Sign-in is not configured"                                 | `auth-config.json` missing or `EXPO_PUBLIC_AUTH_*` unset.                                       |
| State/verifier error after returning                        | Pending sign-in was cleared (new tab, private mode, app restart). Start again.                  |
| CSP blocks token/JWKS request                               | Hosted UI or Cognito region changed; update the CSP and redeploy.                               |
| Google prompt appears repeatedly                            | Cognito session ended or cookies blocked; expected after sign-out.                              |

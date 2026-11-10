# Iron Altar

Strength training tracker with a heavy metal / Greek mythology theme (Milo of Croton),
rendered as an 8-bit pixel-art RPG. Train to feed a Tamagotchi-style avatar that grows
as you get stronger. Runs on iOS, Android, and web.

This is a **tenant application** on the `stevenclarke.dev` platform. The shared AWS
foundation (Route 53 hosted zone, wildcard certificate, GitHub OIDC, per-app deploy
roles, VPC, monitoring) is owned by
[`stevenclarke-infrastructure`](../stevenclarke-infrastructure); this repository owns its
own application resources (S3 bucket, CloudFront distribution, DNS records) and the Expo
app, and supports two deployments: `preview` and `prod`.

## Repository structure

- [spec.md](./spec.md) - Original brief
- [plan.md](./plan.md) - Build plan, phases, decisions, and status
- `src/` - Expo Router screens, domain logic, data layer, state, and UI
- `assets/` - Fonts, sprites, and app icons
- `infra/` - Application CDK stack (S3, CloudFront, DNS records) — planned in P7.1
- `.github/workflows/` - CI workflow (deploy workflows land in P7.1)

## Hostnames

| Deployment | Hostname                              |
| ---------- | ------------------------------------- |
| Production | `iron-altar.stevenclarke.dev`         |
| Preview    | `iron-altar-preview.stevenclarke.dev` |

## AWS authentication (IAM Identity Center SSO)

This project uses AWS IAM Identity Center (SSO). Configure once, then log in as needed.

```bash
aws configure sso --profile admin
# SSO start URL: your AWS Access Portal URL
# SSO region: us-east-2
# CLI default region: us-east-2
# CLI profile name: admin
```

Add `AWS_PROFILE` to your shell profile (e.g. `~/.zshrc`):

```bash
echo 'export AWS_PROFILE=admin' >> ~/.zshrc
source ~/.zshrc
```

Daily usage:

```bash
aws sso login --profile admin
aws sts get-caller-identity
```

Tokens expire periodically; re-run `aws sso login` if you get
`Unable to locate credentials`. Primary region is `us-east-2`; CloudFront certificates
live in `us-east-1`.

## Development

1. Install dependencies: `npm install`
2. Start the dev server: `npm start` (or `npx expo start`) and press `i`, `a`, or `w` to
   open iOS, Android, or web
3. Lint: `npm run lint`
4. Format: `npm run format` (check with `npm run format:check`)
5. Typecheck: `npm run typecheck`
6. Build web: `npm run build` (static export to `dist/`)

Use `npx expo install <package>` instead of `npm install <package>` so Expo resolves an
SDK-compatible version. Expo Go only includes its bundled native modules; after adding a
library with native code, use a development build (`npx expo run:ios|android` or
`eas build --profile development`).

## Application infrastructure (CDK)

Application infrastructure will live in `infra/` and read shared values from SSM (domain
name, hosted-zone ID, wildcard certificate ARN published by the platform) rather than
hardcoding them. It is planned as part of P7.1.

```bash
cd infra
npm install
npm run build
npx cdk synth -c environment=preview   # or -c environment=prod
npx cdk diff -c environment=preview
npx cdk deploy -c environment=preview --all
```

The stack will use Origin Access Control (OAC), create its own DNS records in the shared
hosted zone, and be tagged `project`, `environment`, `owner`, `application`, `managed-by`.

## Branch conventions

- `main` — production. Merges require PR approval via the `production` GitHub Environment
  and deploy to `iron-altar.stevenclarke.dev`.
- `preview` — integration. Merges auto-deploy the preview environment at
  `iron-altar-preview.stevenclarke.dev`.
- `phase/<n>` or `phase/<n>-<description>` — plan-phase work (e.g., `phase/7-hosting`).
- `<issue-number>-<description>` — issue-driven work.

## Deployment

CI runs on every pull request and on pushes to `main`:

- `npm ci`
- `npm run format:check`
- `npm run lint`
- `npm run typecheck`
- `npm run build`

Continuous deployment via GitHub Actions with OIDC (no long-lived AWS keys) lands with the
CDK infrastructure in P7.1:

- Merge to `preview` → auto-deploy `iron-altar-preview.stevenclarke.dev` using
  `iron-altar-deploy-preview`.
- Merge to `main` → deploy `iron-altar.stevenclarke.dev` using `iron-altar-deploy-prod`
  after manual approval through the `production` GitHub Environment.

Before the first deploy, set the GitHub repository variables `DEPLOY_ROLE_ARN` (prod) and
`PREVIEW_DEPLOY_ROLE_ARN` (preview) from the platform SSM parameters
(`/platform/roles/iron-altar/{prod,preview}/deploy-role-arn`).

## Contributing

Follow the conventions in [AGENTS.md](./AGENTS.md) and [plan.md](./plan.md). Update
`plan.md` as you complete plan items.

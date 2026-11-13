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
- `infra/` - Application CDK app (S3, CloudFront, DNS records, mobile release bucket)
- `.github/workflows/` - CI, preview deploy, and production deploy workflows

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

Application infrastructure lives in `infra/` and reads shared values from SSM (domain
name, hosted-zone ID, wildcard certificate ARN published by the platform) rather than
hardcoding them. The app uses the platform's existing CDK bootstrap and never runs
`cdk bootstrap` itself.

Stacks:

- `iron-altar-preview-site` / `iron-altar-prod-site` — private S3 origin behind CloudFront
  (OAC), cache and security headers, SPA fallback, and Route 53 A/AAAA alias records.
- `iron-altar-prod-release` — private, versioned, encrypted bucket for signed mobile
  artifacts.

```bash
cd infra
npm install
npm run build
npm test
npx cdk synth -c environment=preview   # or -c environment=prod
npx cdk diff -c environment=preview
npx cdk deploy -c environment=preview --all
```

Stacks use Origin Access Control (OAC), create their own DNS records in the shared hosted
zone, and are tagged `project`, `environment`, `owner`, `application`, `managed-by` (plus
`Environment` for the platform preview-cleanup guardrail).

## Branch conventions

- `main` — production. Merges require PR approval via the `production` GitHub Environment
  and deploy to `iron-altar.stevenclarke.dev`.
- `preview` — integration. Merges auto-deploy the preview environment at
  `iron-altar-preview.stevenclarke.dev`.
- `phase/<n>` or `phase/<n>-<description>` — plan-phase work (e.g., `phase/7-hosting`).
- `<issue-number>-<description>` — issue-driven work.

## Deployment

CI runs on every pull request and on pushes to `main`:

- App: `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm run build`
- Infrastructure: `npm ci`, `npm run build`, `npm test`, and `npx cdk synth` for preview
  and prod

Continuous deployment uses GitHub Actions with OIDC (no long-lived AWS keys):

- Push to `preview` → `preview.yml` assumes `iron-altar-deploy-preview`, deploys
  `iron-altar-preview-site`, syncs the web export to S3, and invalidates CloudFront.
- Push to `main` → `deploy.yml` waits for approval through the `production` GitHub
  Environment, assumes `iron-altar-deploy-prod`, deploys the prod stacks, syncs the web
  export, and invalidates CloudFront.

The workflows read `vars.PREVIEW_DEPLOY_ROLE_ARN` and `vars.DEPLOY_ROLE_ARN`, set from
`/platform/roles/iron-altar/{preview,prod}/deploy-role-arn` in `us-east-2`.

The web export is uploaded in three passes: immutable `_expo/static/*` bundles, short-cache
assets, and no-cache `index.html`/`deployment.json`. `deployment.json` records the
environment, commit, ref, and deploy time.

## Contributing

Follow the conventions in [AGENTS.md](./AGENTS.md) and [plan.md](./plan.md). Update
`plan.md` as you complete plan items.

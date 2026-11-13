# AGENTS.md

Working conventions for this repository.

## Project

This is a **tenant application** on the `stevenclarke.dev` platform. The shared AWS
foundation (Route 53 hosted zone, wildcard certificate, GitHub OIDC, per-app deploy
roles, VPC, monitoring) is owned by `stevenclarke-infrastructure`. This repository owns
its application resources — the S3 bucket, CloudFront distribution, DNS records, and the
Expo app — and supports two deployments: `preview` and `prod`.

## Branching and PR workflow

Follow this process for all changes:

1. **Start from `main`**

   ```bash
   git checkout main
   git pull origin main
   ```

2. **Create a phase/feature branch**
   - For plan phases: `phase/<n>` or `phase/<n>-<description>` (e.g., `phase/7-hosting`)
   - For issue-driven work: `<issue-number>-<description>` (e.g., `12-fix-rest-timer`)
   - For ad-hoc work: a short descriptive branch name

   ```bash
   git checkout -b phase/7-hosting
   ```

3. **Make changes and commit**

   ```bash
   git add <files>
   git commit -m "Concise description of changes"
   ```

4. **Push and open a PR**

   ```bash
   git push -u origin phase/7-hosting
   gh pr create --base main --head phase/7-hosting \
     --title "Phase 7: Hosting" \
     --body "Describe changes, link to plan items, and note any follow-ups."
   ```

5. **Address review comments**, push updates, then merge after approval and passing checks.

6. **Merge and clean up**
   ```bash
   git checkout main
   git pull origin main
   git branch -d phase/7-hosting
   ```

## Branches

- `main` — production. Merges require approval via the `production` GitHub Environment
  and deploy to `iron-altar.stevenclarke.dev`.
- `preview` — integration. Merges auto-deploy the preview environment at
  `iron-altar-preview.stevenclarke.dev`.
- `phase/<n>` or `phase/<n>-<description>` — plan-phase work (e.g., `phase/7-hosting`).
- `<issue-number>-<description>` — issue-driven work.

## AWS authentication

Use IAM Identity Center SSO with profile `admin`:

```bash
aws sso login --profile admin
export AWS_PROFILE=admin  # set in ~/.zshrc
aws sts get-caller-identity
```

Tokens expire periodically; re-run `aws sso login` as needed. Primary region is
`us-east-2`; CloudFront certificates live in `us-east-1`.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npm run build               # static web export to dist/
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run `npm run format:check`, `npm run lint`, and `npm run typecheck` before declaring any
task done.

## Navigation & Routing

- Use **Expo Router** for all navigation. Routes live in `src/app/` — every file there is a screen, `_layout.tsx` files define navigators. Keep non-route code (components, hooks, utils) outside `src/app/`.
- Import `Link`, `router`, and `useLocalSearchParams` from `expo-router`.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## CDK workflow (application infrastructure)

Application infrastructure lives in `infra/` and reads shared values from SSM (domain
name, hosted-zone ID, wildcard certificate ARN, deploy-role ARNs published by the
platform) rather than hardcoding them. The app uses the platform's existing CDK bootstrap
and never runs `cdk bootstrap` itself.

Stacks: `iron-altar-preview-site`, `iron-altar-prod-site`, and
`iron-altar-prod-release` (mobile artifacts).

```bash
cd infra
npm install
npm run build                              # tsc
npm test                                   # CDK assertions + cdk-nag
npx cdk synth -c environment=preview       # or -c environment=prod
npx cdk diff -c environment=preview
npx cdk deploy -c environment=preview --all
```

- Use `-c environment=preview|prod` to select the target. Default to `preview` for safety
  when deploying from the workstation.
- Tag all resources `project`, `environment`, `owner`, `application`, `managed-by` (plus
  `Environment` for the platform preview-cleanup guardrail).
- Use platform deploy roles via GitHub OIDC in CI; do not store long-lived AWS keys.
  `preview.yml` assumes `vars.PREVIEW_DEPLOY_ROLE_ARN`; `deploy.yml` assumes
  `vars.DEPLOY_ROLE_ARN` after the `production` Environment approval.
- `cdk synth` runs `cdk-nag` via the CDK policy validation framework; keep the
  acknowledgments in `infra/lib/*-stack.ts` narrow and documented.

## Code conventions

- Expo + React Native + TypeScript, Expo Router for navigation, Zustand for state.
- AWS CDK (TypeScript) in `infra/` for application resources.
- Run `npm run format:check`, `npm run lint`, and `npm run typecheck` before committing.
- Keep AWS account IDs, secrets, and credentials out of the repository.

## Commit messages

- Keep concise and descriptive.
- Reference plan phases/items when relevant.
- Do not commit secrets or keys.

## Plan tracking

- Update `plan.md` in your feature branch as you work. Mark items `[x]` when complete and
  `[ ]` when pending/in progress.
- Keep the plan in sync with decisions made during implementation.
- **Every implementation commit on a phase branch MUST update `plan.md` to reflect
  completed action items for that phase.**
- When opening/updating a PR for a phase, mark that phase **Completed** in `plan.md`
  (e.g., `### Phase 7: ... (Completed)`) and check off all completed items.

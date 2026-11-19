# Iron Altar — Build Plan

Strength training tracker with a heavy metal / Greek mythology theme (Milo of Croton),
rendered as an 8-bit pixel-art RPG. Gamified via a Tamagotchi-style avatar that grows
as you train. Must run on iOS, Android, and web.

- **MVP target:** end of November 2026
- **First public milestone:** hosted web URL linked from the portfolio (P7.1)
- **Release intent:** personal use first, public release later (App Store / Play / web)

## 0. Resolved Decisions

### Platform & stack

- **Expo (React Native) + TypeScript.** One codebase for iOS, Android, web.
- **Real web deployment target** — we will ship a hosted URL (static web export).
- **Offline-only, no accounts, no login for v1.** Data is local-first. Architecture must
  keep an auth/sync seam. Google sign-in is scoped as P9 (blocked on platform Phase 10);
  cloud sync remains deferred.

### Data & tracking

- **Main lifts:** Squat, Bench, Deadlift, Overhead Press, Power Clean (5).
- **Units:** user-selectable — kg / lb / stone (st). Display conversion only; store canonical kg.
- **No supersets / dropsets / timed holds** in v1 — use the notes field for special cases.
- **Bodyweight-only exercises** are logged with weight `0`.
- **Rest timer:** yes. **Plate calculator:** no.
- **Body weight:** manual entry only. No scale / health API.
- **Set data:** weight x reps only. RPE / RIR captured in the notes field.
- **Warmup sets:** flagged per set and **excluded from XP** (working sets only).

### Gamification / avatar

- **XP source:** total volume (weight x reps) of **working sets only** (warmups excluded).
- **10 avatar stages**, XP range 0–1000.
- **Decay:** lose a set amount of XP per week when not training.
- **Trend indicator:** show when XP is trending up vs down.
- **Streak:** resets if a week passes with no training. No badges, achievements, or quests in v1.

### Art & audio

- **Placeholder pixel sprites**, with a documented sprite-sheet format.
- **Selectable characters:** scaffold the data/plumbing for multiple characters each with
  their own sprite sets, but implement only one character for now.
- **No sound / music in v1** (planned later).
- **Palette:** SNES _Chrono Trigger_-inspired but darker / goth-leaning.

### Scope & delivery

- **P0 includes** repo setup + lint/format. **No CI** in P0; hosting and CI/CD land in
  **P7.1** (section 7).

### Deferred (revisit later)

- Federated login + cloud sync.
- Sound effects / chiptune music.
- Additional characters.

## 1. Tech Stack

- **Framework:** React Native + **Expo** (latest SDK) with `react-native-web`.
- **Language:** TypeScript.
- **Navigation:** Expo Router (file-based; real URLs on web).
- **State:** Zustand with a repository layer over storage.
- **Auth (P9):** platform shared **Amazon Cognito** user pool with Google federation; an
  app-owned public PKCE client per environment, using `expo-auth-session` + `expo-crypto`.
- **Persistence:** local-first, **single versioned JSON document** (`AsyncStorage`) behind a
  repository layer, with migrations in `src/data/db`.
  - **Why not SQLite (chosen during P1):** `expo-sqlite` on web requires `SharedArrayBuffer`
    plus `COEP`/`COOP` headers on every host, which risks the hard "must run in a web
    browser" constraint on static hosting. A JSON document is portable everywhere with no
    runtime/bundle config and is ample for a personal training log.
  - The repository seam keeps a future SQLite (or server) swap open.
- **Charts:** `react-native-svg` with custom pixel chart primitives (`PixelLineChart` /
  `PixelBarChart`), chosen during P5. Victory Native was dropped because its current
  versions require Skia (a development build on native) while the pixel aesthetic is
  simple to draw directly; `react-native-svg` works in Expo Go and on web.
- **Animation:** Reanimated 3 + `moti`; sprite frames via `expo-image` or a lightweight
  sprite-sheet component.
- **Styling:** design-token theme + StyleSheet (NativeWind optional, not required).
  Pixel look via custom font (Press Start 2P) and a strict palette.
- **Testing:** Jest + React Native Testing Library. (Maestro e2e later.)
- **Web deploy:** `expo export --platform web` (`web.output: "single"` SPA) to a private
  **AWS S3** origin behind **CloudFront**, with **Route 53 + ACM** for
  `stevenclarke.dev`; provisioned with **AWS CDK v2 (TypeScript)** and deployed by
  **GitHub Actions** (section 7).
- **Mobile releases:** **EAS Build** production `.ipa` / `.aab`, archived with version
  metadata and checksums in a private, versioned **S3** bucket for future App Store /
  Play Store publishing workflows.

## 2. Architecture

```
src/
  app/                    # screens (Expo Router)
    (tabs)/index          # Session / landing
    (tabs)/history
    (tabs)/progress       # data viz
    (tabs)/profile
    session/[id]          # active session log
    welcome               # Landing gate: Google or anonymous (P9.1)
    auth/callback         # OIDC redirect handler (P9)
    logout                # sign-out (P9)
  domain/                 # types + pure logic (XP, volume, 1RM, stage calc, units)
  data/                   # db, repositories, migrations, seed, auth/sync seam
  auth/                   # OIDC client, PKCE, token validation, session store (P9)
  state/                  # zustand stores
  ui/                     # components, theme, pixel primitives, avatar
  art/                    # sprite-sheet format + character registry
  constants/theme.ts      # design tokens
assets/                   # fonts, sprite sheets
```

**Auth/sync seam:** all reads/writes go through repositories. A `SyncAdapter` interface
(no-op in v1) sits behind them so a remote backend + login can be slotted in later without
touching UI. P9 adds Google sign-in through the platform's shared Cognito pool for identity
only; sync stays a no-op and no training data leaves the device.

## 3. Data Model

- **Profile**: `id, name, characterId, unitPref (kg/lb/st), createdAt, xp, stage`
- **Character**: `id, name, spriteSheet, stageCount` (registry; one implemented now)
- **Exercise**: `id, name, category (barbell/bodyweight/dumbbell), isMainLift, muscleGroup`
- **Session**: `id, date (performed calendar day, user-chosen), startedAt?, endedAt?, notes,
completed, totalVolume, xpEarned` — timestamps are present only for live sessions.
- **SetEntry**: `sessionId, exerciseId, weightKg, reps, isWarmup, notes?, order`
- **BodyWeight**: `id, date, weightKg`
- **AvatarStage**: derived from XP — 10 tiers over 0–1000 XP -> sprite tier + animation set

Notes:

- Store weights canonically in **kg**; convert at the display layer per `unitPref`.
- XP = **1 per working set** (`SetEntry` where `isWarmup = false`), independent of weight,
  reps, or bodyweight.

## 4. Feature Breakdown (from spec)

1. **Session (landing)** — lean workout entry point with Start/Resume Workout; retroactive
   logging uses the session log's date selector. Avatar and training summary live on Profile.
2. **Profile** — avatar render + stats (XP, stage, best lifts, body weight, streak).
3. **Session Log** — pick/add exercises, log weight/reps/notes per set, flag warmups,
   rest timer, per-set completion animation, finish -> workout-complete animation + XP.
4. **Workout History** — reverse-chron summary cards (date, exercises, volume, xp).
5. **Data Viz** — line/bar charts per main lift + body weight.
6. **Gamification** — XP formula, 10 avatar stages, weekly decay, weekly streak reset,
   XP up/down trend indicator.
7. **Google sign-in (P9)** — optional sign-in via the platform's shared Cognito pool and
   Google federation; identity only, no feature gating, no data leaves the device.

## 5. Phases / Milestones

### Phase 0: Scaffold — Completed

- [x] Expo + TypeScript init with Expo Router.
- [x] Lint and format tooling.
- [x] tsconfig path aliases.
- [x] Theme tokens and pixel font.
- [x] Base UI primitives.
- [x] Skeleton routes.
- [x] Runs on iOS, Android, and web.

### Phase 1: Data — Completed

- [x] Versioned JSON document + migrations.
- [x] Repositories for profile, exercise, session, body weight, and draft.
- [x] Seed exercises (5 main lifts + accessories).
- [x] SyncAdapter seam.
- [x] Typed stores on repositories.
- [x] Unit conversion.
- [x] Persisted active/draft session (refinement #2 prerequisite).
- [ ] Tests (deferred to a later phase).

### Phase 1.1: Session Entry Date — Completed

- [x] `Session.date` becomes the user-chosen performed calendar day (`YYYY-MM-DD`); `startedAt`/`endedAt` are optional (live sessions only).
- [x] `DraftSession` carries the entry date.
- [x] `DB_VERSION` → 2 with a migration normalizing legacy dates.
- [x] Repository sorts by performed date.
- [x] Store gains `start(date?)` + `setEntryDate` (refinement #3 data model — prerequisite for retroactive workouts in P3).

### Phase 2: Profile + Avatar — Completed

- [x] Character registry.
- [x] Avatar component.
- [x] Sprite-sheet loader.
- [x] Stage calculation.
- [x] Profile screen.

### Phase 3: Session Log — Completed

- [x] Exercise picker (main lifts + accessories).
- [x] Set entry (weight/reps/warmup/notes).
- [x] Rest timer (presets 60/90/120/180s, auto-start on set, survives navigation).
- [x] Validation.
- [x] Resume affordance on the Session page (#2).
- [x] Retroactive date control on the session screen over the P1.1 entry-date model (#3).
- [x] Duplicate-set button: per-set `2X` + "Repeat Last Set" (#1; glyph changed to `+` in P3.1).

### Phase 3.1: Session Log Refinements — Completed

- [x] Configurable minute/second rest timer with persistence (#8).
- [x] Navigation back to gym/history (#9).
- [x] Unit-aware tonnage (#10).
- [x] Sets grouped by exercise (#11).
- [x] Editable logged reps (#12).
- [x] Same-weight sets collapsed to one row (#13).
- [x] Duplicate-set glyph changed from `2X` to `+` (#14).
- [x] Structural items (rest-timer persistence, `updateSet`) landed before the layout items that build on them.

### Phase 4: History — Completed

- [x] Reverse-chronological history list.
- [x] Session detail view.
- [x] Render retroactively-dated sessions (#3).

### Phase 5: Data Viz — Completed

- [x] Custom SVG pixel chart components.
- [x] Per-lift screens.
- [x] Body-weight screen.
- [x] Manual body-weight entry.
- [x] Per-exercise working-set aggregation seam (#6).

### Phase 5.1: Demo Visual Consistency — Completed

- [x] Locked top navigation on every screen.
- [x] Bottom tab bar hidden.
- [x] `Screen` gains a fixed `header` slot.
- [x] `NavBar` highlights the active tab (#7).
- [x] Rest-timer stepper arrow glyphs fixed (#15).

### Phase 6: Gamification & Animations — Completed

- [x] Weekly streak + XP decay from the manual performed date (`Profile.lastActivityDate`, `DB_VERSION` → 4).
- [x] Trend indicator.
- [x] XP-to-next-stage bar.
- [x] Set-complete flash.
- [x] Workout-complete overlay with avatar growth.
- [x] Animations use React Native `Animated` (native driver off on web) so no extra dependency is needed.
- [x] Streak/decay follow backdated workouts (#3).
- [x] Working-set counts feed Profile stats and the per-exercise seam (#6).

### Phase 6.1: Session Log & XP Refinements — Completed

- [x] Rest timer moved to its own `/rest-timer` screen (#16).
- [x] Reps edit field constrained to two digits (#17).
- [x] Reps edit field left-aligned (#18).
- [x] XP switched from tonnage to 1 per working set (#19).
- [x] DB v5 rebuild of stored session/profile totals (#19).

### Phase 6.2: Session/Profile IA & Stats — Completed

- [x] `/` is a lean Session entry screen containing only Start/Resume Workout (#20).
- [x] Avatar and training summary live exclusively on Profile (#20).
- [x] "Log Past Workout" removed in favor of the session date selector (#21).
- [x] Body weight editable on Profile (#22).
- [x] "Decaying" only appears after a full week without training (#23).

### Phase 7.1: App Hosting on the Platform — In progress (production live; portfolio link pending)

- [x] Document the platform contract, SSM values, and preview/prod hostnames (section 7).
- [x] Add the branch and environment model to the plan.
- [x] Add PR CI checks (`.github/workflows/ci.yml`).
- [x] Confirm platform onboarding: hosted zone, shared certificate, OIDC provider, `iron-altar` preview/prod roles, and the SSM contract (SSM parameters and deploy roles verified in `us-east-2`).
- [x] Scaffold `infra/` as a CDK v2 TypeScript app with environment config, naming/tags, `cdk-nag`, and tests.
- [x] Implement the preview and prod `StaticSiteStack` instances: S3, OAC, CloudFront, Route 53 aliases, cache/header behavior, SPA fallback, and app-scoped outputs.
- [x] Deploy the preview stack and verify DNS, HTTPS, SPA deep links, headers, caching, and rollback. Preview is live at https://iron-altar-preview.stevenclarke.dev; the first failed deploy rolled back cleanly, and the corrected deploy passed.
- [x] Add the automatic `preview` deploy workflow (`preview.yml`).
- [x] Add the approved `main` production deploy workflow (`deploy.yml`).
- [x] Deploy production, approve, and verify `iron-altar.stevenclarke.dev`. Production is live at https://iron-altar.stevenclarke.dev; the production environment approval was granted and the deploy passed.
- [ ] Link the production URL from the portfolio (`https://iron-altar.stevenclarke.dev`; the portfolio currently uses `https://ironaltar.stevenclarke.dev`).

### Phase 7.2: Mobile Release Archive — In progress

- [ ] Add `eas.json`, `dev.stevenclarke.ironaltar` bundle/package IDs, remote version source, and the production profile.
- [x] Create the private, versioned, encrypted mobile release bucket in the app CDK stack (`iron-altar-prod-release`).
- [ ] Add the mobile archive workflow (`build-mobile.yml`) for `v*` tags and manual dispatch.
- [ ] Verify the artifact + metadata layout and SHA-256 checksums.
- [ ] Keep store submission as a future workflow (out of scope for this phase).

### Phase 7.3: Polish & Launch — Not started

- [ ] Responsive web pass.
- [ ] Accessibility pass.
- [ ] Empty states.
- [ ] Privacy and support pages.
- [ ] Store listing metadata.
- [ ] Text-file import (#4, post-MVP candidate; confirm format before building).

### Phase 8: In-App Issue Reporting — Design in review

- [x] Document the client flow, data collection, API contract, privacy model, and backend
      `IssueIntakeStack` design in `docs/issue-reporting-design.md`.
- [x] Generate architecture, ingest/worker sequence, and report-lifecycle diagrams in
      `docs/issue-reporting-architecture.md`.
- [ ] Implement the intake stack and GitHub App integration in `issue-reporter`.
- [ ] Publish `@issue-reporter/core` and `@issue-reporter/client` from `issue-reporter` so
      tenant apps import the contract, redaction, transport, and error mapping.
- [ ] Add the report button, screenshot capture, full app-data snapshot, logs, stack
      traces, secret redaction, and public-report acknowledgement to the client.
- [ ] Create GitHub labels and the GitHub App installation.
- [ ] Deploy preview, verify end-to-end, then roll out production.

### Phase 9: Google SSO Sign-In — Implemented (preview verification pending)

Platform contract: `../stevenclarke-infrastructure/docs/google-sso-for-tenant-apps.md`.
The platform `AuthStack`/`OidcStack` is deployed and `/platform/auth/*` resolves in
`us-east-2`; the preview app client and CSP are live. Sign-in is identity-only. Phase 9.1
below changes the entry flow from optional in-app sign-in to a landing gate; Google remains
optional because anonymous access is always available.

- [x] Confirmed the platform Hosted UI domain, shared pool, Google IdP, `/platform/auth/*`
      params, and the app deploy roles' scoped `cognito-idp` client permissions.
- [x] Added auth SSM paths to `infra/config/environments.ts`; no pool IDs, account IDs, or
      Google credentials are committed.
- [x] Created a public `UserPoolClient` per environment in the site stack: imported shared
      pool, auth-code + PKCE only, `openid email profile`, no client secret, 1 h ID/access
      tokens, 30 d refresh token.
- [x] Registered web prod/preview callbacks, `localhost`/`127.0.0.1:8081` for local dev, and
      native `ironaltar://auth/callback` (Cognito accepts custom schemes; `exp://` is
      unstable, so native SSO requires a development build).
- [x] Published the client ID as the site stack's `AuthClientId` output; deploy workflows
      write `auth-config.json` (domain, issuer, JWKS, client ID, logout URI) before S3 sync.
      SSM publishing is deferred because app deploy roles only have `ssm:GetParameter`.
- [x] Added `expo-auth-session`, `expo-crypto`, `expo-secure-store`, and `jose`; implemented
      PKCE + state, code exchange, claim validation, web signature verification, session
      restore/refresh, and a Zustand auth store in `src/auth/` and `src/state/auth-store.ts`.
- [x] Added the original `/login` route (superseded by `/welcome` in P9.1), plus
      `/auth/callback`, `/logout`, and an Account panel on Profile; cancel/errors fall back to
      the app and "Continue without signing in" is always present.
- [x] Web keeps tokens in memory and relies on the shared Cognito session for re-auth;
      native uses SecureStore and refreshes before expiry; refresh tokens never touch
      `localStorage`.
- [x] Extended the CloudFront response headers policy with CSP `connect-src`,
      `form-action`, and `img-src` entries for Hosted UI, JWKS, and Google avatars.
- [x] Kept sign-in identity-only: no feature gating, no sync, local-first data flow
      unchanged, and the `SyncAdapter` remains a no-op.
- [x] Added CDK assertions for the public client, PKCE flow, callback URLs, and CSP.
      Client-side unit-test coverage remains a follow-up (the app has no Jest harness yet).
- [x] Added `docs/google-sso.md` with app-specific values, redirect matrix, local setup,
      session behavior, CSP, and troubleshooting; linked it from the README.
- [x] Platform follow-up shipped: Google `email_verified` is mapped onto Cognito's
      `email_verified` attribute (`cognito.ProviderAttribute.GOOGLE_EMAIL_VERIFIED`) in
      `stevenclarke-infrastructure` (PR #29). The shared pool also uses a mutable `email`
      attribute so repeat federated sign-ins no longer fail with
      `"SIGN-IN FAILED user.email: Attribute cannot be updated."`.
- [x] Deployed the preview stack: client `iron-altar-preview` created, CSP live, and the
      authorize request redirects to Google's consent screen.
- [ ] Complete interactive sign-in/out verification on preview web and a development build,
      then deploy production.

### Phase 9.1: Landing Gate & Anonymous Access — Completed

Goal: every app load starts at `/welcome`. The user must choose **Sign in with Google** or
**Continue as anonymous** before any app route is reachable. Google stays optional; anonymous
is a local identity mode, not a separate database, profile, or sync state. Signing out
returns to `/welcome`.

Decisions:

- Persist the entry choice. Anonymous survives reloads: `localStorage` on web, SecureStore on
  native. Native Google sessions restore from SecureStore as they do today. Web Google tokens
  stay memory-only, so a hard reload returns to `/welcome`; signing in again reuses the shared
  Cognito session so Google usually does not prompt.
- Put the landing page at `/welcome` and remove `/login`. Keep `/auth/callback` reachable
  without an entry so the redirect can complete.
- Gate routes with Expo Router `Stack.Protected` plus `unstable_settings.anchor = 'welcome'`
  (SDK 58; `initialRouteName` is deprecated). Direct and deep links without an entry redirect
  to the landing page; browser back to `/welcome` after entry redirects home.
- Extend the auth store with an `anonymous` status and `continueAnonymous()`. It persists the
  anonymous marker and clears any Google session or pending auth. `setSession()` clears the
  anonymous marker. Logout clears both the marker and the Google session.
- The landing screen owns the busy/error states for Google sign-in. Callback success replaces
  to `/`; callback failure offers retry or anonymous. The Account panel shows the Google
  identity or **Anonymous** and a sign-out action; switching modes requires signing out.
- Training data remains local-first and unchanged. Anonymous users share the same local
  database and profile rules as Google users. No backend, refresh-token-at-rest, or CSP
  changes are required.
- Before Google sign-in can be tested, the tester's Google account must be added as a test
  user in the platform-owned Google Cloud project (`279862640725`); see
  `docs/google-sso.md#google-cloud-test-users`.

Action items:

- [x] Persist the anonymous marker and add the `anonymous` auth status and
      `continueAnonymous()` action; clear the marker on Google entry and on logout.
- [x] Add `/welcome` with Google and anonymous actions; remove `/login` and update links.
- [x] Rebuild the root layout guard with `Stack.Protected`, the `welcome` anchor, and
      splash-screen gating on auth hydration.
- [x] Update the callback, logout, and Account panel for the anonymous/Google entry modes.
- [x] Document the flow, persistence matrix, and test-user setup; update the Account panel
      copy.
- [ ] Verify deep links, reload persistence, anonymous/Google logout, and callback
      completion on preview web and a development build; deploy preview, then production.

### Phase 9.2: Explicit Google Consent & Profile User ID — Completed

Goal: make Google data sharing visible at sign-in, and show the active entry identity on the
Profile screen. Both are presentation/UX changes; neither adds accounts, sync, or new storage.

Decisions:

- Google currently reuses prior consent, so returning users may skip its consent page.
  `beginSignIn()` sends `prompt: Prompt.Consent` with `identity_provider=Google` for
  managed-login compatibility.
- A live check against the deployed preview client showed the classic Hosted UI drops
  `prompt=consent` before redirecting to Google. To guarantee the user agrees to what is
  shared, `/welcome` now shows an in-app consent confirmation listing the Google email and
  basic profile data before redirecting. The user can go back without signing in.
- Platform follow-up: migrate the shared pool to managed login branding if Google's own
  consent screen should appear every time. Track it in `stevenclarke-infrastructure`; do not
  create a second OAuth client or silently change scopes.
- Keep the existing `openid email profile` scopes for now, but verify the consent screen
  lists email sharing. Narrowing to `openid email` is a separate decision if the Account
  panel no longer needs profile data.
- Add a **User ID** row on `/profile` sourced from `useAuthStore`: `session.identity.email`
  for Google entry, the literal `anonymous` for anonymous entry. Do not add an identity field
  to the local profile record or change persistence.
- Auth hydration already completes before protected routes render, so Profile should normally
  have a resolved status; render `—` only as a defensive loading value.

Action items:

- [x] Add `Prompt.Consent` to `beginSignIn()` in `src/auth/client.ts`.
- [x] Confirm live that the classic Hosted UI drops the prompt; add an in-app consent
      confirmation to `src/app/welcome.tsx` and document the platform follow-up.
- [x] Add a `User ID` row to `src/app/(tabs)/profile.tsx` using the existing `StatRow`
      pattern: Google email or `anonymous`.
- [ ] Verify on preview web and a development build: in-app consent appears before the Google
      redirect and Google entry still completes; Profile User ID is the Google email; anonymous
      entry shows `anonymous`; sign-out returns to `/welcome`.
- [ ] Deploy preview, then production after verification. Google test users still need to
      be registered in the platform-owned Google Cloud project before SSO testing.

## 6. Feature Refinements (triaged)

Efficiency rule: fold **structural** items (data model, domain, persistence, architecture)
in as early as possible; defer **experiential** items (polish, feel, copy) until the feature
can actually be used. Each phase pulls in the refinements that intersect its surface area.

| #   | Refinement                                                                                                                                                                              | Phase                                                           | Notes                                                                                                                                                                                                                                                                                                                                                                    |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| 1   | Duplicate-set button: re-log a set with the same weight x reps without re-entering.                                                                                                     | **P3** (Session Log) — copy shipped, glyph to change            | Operates on the existing `SetEntry` shape — no schema/domain change. Shipped as per-set `2X` plus a "Repeat Last Set" button. Follow-up: replace the `2X` glyph with `+` — `2X` reads as a set-count/multiplier and is confusing.                                                                                                                                        |
| 2   | In-progress session survives leaving the screen, so the user can check prior sessions and return.                                                                                       | **P1** (persist) + **P3** (UX) — shipped                        | Structural. Phase A (P1): persist the draft session instead of the in-memory `useSessionStore`, so it survives navigation and app restart. Phase B (P3): Resume affordance on the Session page + return to the active session.                                                                                                                                           |
| 3   | Log retroactive workouts for prior dates.                                                                                                                                               | **P1.1** (data) + **P3** (UX) + **P6** (streak/decay) — shipped | Structural. P1.1 shipped the data model: `Session.date` is the performed calendar day, `startedAt`/`endedAt` are optional (live only), and the draft/store carry a settable entry date. P3 shipped the session date stepper (the Gym shortcut was removed by #21). P4 renders it in History; P6 computes weekly streak/decay from performed dates.                       |
| 4   | Import workout data from a text file.                                                                                                                                                   | **P7** (post-MVP candidate)                                     | Needs a documented import format (CSV/JSON), a bulk-insert repository method with de-dupe, and platform file pickers (web input vs native document picker). Defer until the data model is stable; scope risk vs the Nov MVP. Doubles as a backfill path for #3.                                                                                                          |
| 5   | Rename "Dungeon Gym" to "Iron Altar" and center the screen title.                                                                                                                       | **Superseded by #20**                                           | The Gym page becomes the Session page (#20), so its tab/heading should read "Session" rather than "Iron Altar"; the app name can live in Profile or landing copy.                                                                                                                                                                                                        |
| 6   | XP should be based on the count of **working sets** (non-warmup), and we should track working sets **per exercise** so progress can be shown per lift, not just as one number.          | **P5** (Data) + **P6.1** (Gamification) — shipped               | Structural: `workingSetsByExercise(sets)` lives in `src/domain/progress.ts` and drives per-lift charts. P6 added lifetime working-set counts to Profile stats; P6.1 switched XP to 1 per working set.                                                                                                                                                                    |
| 7   | Move the navigation bar to the top and lock it so it stays visible while scrolling.                                                                                                     | **P5.1** (Demo) — shipped                                       | Implemented as a persistent `NavBar` in `Screen`'s new fixed `header` slot on every screen, with the bottom tab bar hidden. The bar highlights the active section and uses `navigate` so tabs focus instead of stacking.                                                                                                                                                 |
| 8   | User-definable rest timer in minutes **and** seconds via up/down steppers; default 1:00; persist the chosen value across sessions.                                                      | **P3.1** (Session Log follow-up)                                | Structural (persistence) + experiential (controls). Replace the fixed 60/90/120/180 presets with a minute/second stepper, default 1:00, and persist the chosen duration (extend the draft/document store, not just ephemeral `rest-timer-store`). Main use case is long strength rests (~5:00).                                                                          |
| 9   | Navigation bar on the Session Log page so the user can return to the gym or session history to reference past sessions.                                                                 | **P3.1** (Session Log follow-up)                                | Experiential: expose tab navigation (or in-screen links) on `session/[id]`, which currently sits outside the tab navigator. Depends on #7's navigator decision so the two agree on top vs bottom placement.                                                                                                                                                              |
| 10  | Use the user-selected unit of measure for the tonnage total on the Session Log page.                                                                                                    | **P3.1** (Session Log follow-up)                                | Small: `totalVolumeKg` is already computed; format it with `formatWeight(..., unitPref)` (or the stone/kg/lb display helpers) instead of raw kg. Bug-level polish on the session screen.                                                                                                                                                                                 |
| 11  | Group logged sets by exercise on the Session Log page.                                                                                                                                  | **P3.1** (Session Log follow-up)                                | Experiential layout: render the flat `active.sets` list grouped by `exerciseId` (ordered by main lift then accessories), instead of one continuous list. Pairs with #12/#13.                                                                                                                                                                                             |
| 12  | Allow editing the reps of a logged set (e.g. duplicate a set, then edit reps down after a missed rep).                                                                                  | **P3.1** (Session Log follow-up)                                | Structural: add an `updateSet(setId, patch)` action to `session-store` (+ a draft commit) and an editable reps control in the set row. Extends the duplicate-set (#1) workflow.                                                                                                                                                                                          |
| 13  | Within an exercise, group logged sets of identical weight onto one row (e.g. `225 x 5, 5, 4`).                                                                                          | **P3.1** (Session Log follow-up)                                | Experiential layout over the grouped view (#11): collapse same-`weightKg` sets into a single row showing a comma-separated reps list. Pure presentation; no schema change (reps remain individual `SetEntry` rows).                                                                                                                                                      |
| 14  | Use `+` instead of `2X` for the duplicate-set control.                                                                                                                                  | **P3.1** (Session Log follow-up)                                | Copy/label fix on #1: `2X` is confusing because it reads as a set count/multiplier rather than "add a set". Swap the per-set glyph to `+`. No behavior change.                                                                                                                                                                                                           |
| 15  | Rest-timer minute/second steppers show literal `\u25B2` / `\u25BC` text instead of up/down arrows.                                                                                      | **P5.1** (Demo) — shipped                                       | Bug: JSX string attributes don't process escape sequences, so the arrows rendered as literal backslash text. Use the actual `▲` / `▼` characters.                                                                                                                                                                                                                        |
| 16  | Move the rest timer to its own screen to declutter the session log.                                                                                                                     | **P6.1** — shipped                                              | New `/rest-timer` route reuses the persisted timer store; the session log keeps a single launch button.                                                                                                                                                                                                                                                                  |
| 17  | Make the reps edit box only two digits wide so it no longer overflows when 3+ sets are logged.                                                                                          | **P6.1** — shipped                                              | Fixed-width input plus a flexible, wrapping reps row keeps long set groups inside the panel.                                                                                                                                                                                                                                                                             |
| 18  | Left-align the reps edit box instead of centering its text.                                                                                                                             | **P6.1** — shipped                                              | `textAlign: 'left'` on the reps input.                                                                                                                                                                                                                                                                                                                                   |
| 19  | XP should be 1 per working set per exercise, not based on tonnage.                                                                                                                      | **P6.1** — shipped                                              | `xpFromSet` now returns 1 for non-warmups; DB v5 rewrites stored session XP and rebuilds profile XP from working-set totals.                                                                                                                                                                                                                                             |
| 20  | The Gym and Profile pages duplicate the avatar and training summary. Make the Gym page a lean Session page with only Start/Resume Workout; keep the avatar and summary on Profile only. | **P6.2** (Session/Profile IA & Stats) — shipped                 | Experiential IA cleanup. `/` keeps Start Workout (or Resume when a draft exists) and drops the avatar, XP/streak/trend, and last-trained panels. Profile owns that content. The GYM tab/heading now reads SESSION; this supersedes #5.                                                                                                                                   |
| 21  | Remove the "Log Past Workout" button; retroactive logging can start from Start Workout and use the session date selector.                                                               | **P6.2** (Session/Profile IA & Stats) — shipped                 | Start Workout opens the session log, where `EntryDateStepper` already sets a past performed date (P3/#3). The redundant entry point is gone.                                                                                                                                                                                                                             |
| 22  | Make body weight editable on the Profile page.                                                                                                                                          | **P6.2** (Profile stats) — shipped                              | Add a weigh-in editor to Profile's training panel in preferred units. The latest entry is updated in place via `bodyWeightRepository.update`; with no history, the first entry is added. Progress keeps the chart/history and dated entries.                                                                                                                             |
| 23  | The trend should only say "Decaying" once a week or more has passed since the last logged workout.                                                                                      | **P6.2** (Gamification) — shipped                               | `trainingSummary` no longer compares recent XP with weekly decay. `down` is gated on `weeksSince(lastTrainingDate) >= 1`; otherwise `up` when the latest week has training XP and `flat` with no sessions.                                                                                                                                                               |
| 24  | Use **AWS CDK in TypeScript** for this app’s infrastructure, consuming platform-owned DNS, certificates, and IAM roles through SSM.                                                     | **P7.1** (Hosting) — in progress                                | Structural. The `stevenclarke-infrastructure` repo owns the Route 53 zone, shared wildcard certificate, OIDC provider, and per-app deploy roles. This repo owns `infra/`, the `preview`/`prod` S3 + CloudFront stacks, its Route 53 alias records, and the mobile release bucket. App roles are scoped; this repo creates no shared DNS, certificate, or role resources. |

### Triaged into phases

- **P1 Data (done):** persist the active/draft session (prerequisite for refinement #2).
- **P1.1 Session Entry Date (done):** `Session` supports a user-chosen performed date
  (data model for refinement #3).
- **P3 Session Log (done):** duplicate-set (#1); resume in-progress session UX (#2);
  retroactive workouts — date-stepper UX over the P1.1 entry-date model (#3).
- **P3.1 Session Log Refinements (done):** configurable + persisted rest timer (#8);
  navigation back to gym/history (#9); unit-aware tonnage (#10); group sets by exercise
  (#11); edit logged reps (#12); collapse same-weight sets to one row (#13); duplicate-set
  glyph `2X` -> `+` (#14). Structural items (#8 persistence, #12 edit action) land first;
  layout items (#11, #13) build on them.
- **P4 History (done):** retroactively-dated sessions rendered in list + detail (#3).
- **P5 Data Viz (done):** per-lift working-set counts + top-set charts, body-weight chart
  and manual entry, `workingSetsByExercise` aggregation seam (#6, with P6).
- **P5.1 Demo Visual Consistency (done):** locked top nav on every screen + active-tab
  highlight (#7); rest-timer arrow glyphs (#15).
- **P6 Gamification (done):** manual entry dates drive weekly streak/decay (#3);
  working-set-count / per-exercise XP seam wired into stats (#6).
- **P6.1 Session Log & XP Refinements (done):** rest timer moved to its own screen (#16);
  two-digit left-aligned reps field (#17, #18); XP = 1 per working set with DB v5 rebuild (#19).
- **P6.2 Session/Profile IA & Stats (done):** lean Session page with Start/Resume only
  (#20); "Log Past Workout" removed in favor of the date selector (#21); Profile body-weight
  editing (#22); week-gated decaying trend (#23).
- **P7 Hosting & Ship (in progress):** P7.1 app CDK hosting on the shared platform +
  GitHub Actions (#24; platform contract verified, `infra/` stacks and preview/prod deploy
  workflows in place, preview and production live, portfolio link pending); P7.2 EAS mobile artifacts archived to
  versioned S3 (release bucket stack in place; EAS workflow pending); P7.3 responsive web,
  accessibility, empty states, privacy/support pages, store listing metadata, and text-file
  import (#4) — post-MVP candidate; confirm format before building.
- **P8 In-App Issue Reporting (design in review):** client report form + screenshot capture,
  a platform-global `IssueIntakeStack` in the separate `issue-reporter` repository, a
  published `@issue-reporter/client` library that tenant apps configure, public GitHub
  issues via a GitHub App, diagnostics redaction, rate limits, and a public-report
  acknowledgement.
- **P9 Google SSO (implemented; landing gate shipped in P9.1):** Google sign-in through the
  platform's shared Cognito pool and per-app client. Identity only, no sync. Phase 9.1 added a
  `/welcome` landing gate with Google or anonymous entry and replaced the optional in-app
  sign-in path. Phase 9.2 forces an explicit Google consent prompt and adds a **User ID** row
  to Profile. See sections 5 and 8.

## 7. Hosting & Release Infrastructure (P7.1/P7.2)

### Recommendation

- **Web:** one private **S3** origin behind **CloudFront** (Origin Access Control) per
  environment. `preview` and `prod` are separate stacks with separate buckets and
  distributions in the same AWS account.
- **Infrastructure as code:** **AWS CDK v2 in TypeScript** under `infra/` in this
  repository. The shared platform lives in the separate `stevenclarke-infrastructure`
  repo; this app does not create the hosted zone, shared certificate, OIDC provider, or
  deploy roles.
- **Platform contract:** read the platform values from **SSM Parameter Store in
  `us-east-2`**: hosted zone ID, domain name, shared wildcard certificate ARN, and the
  `iron-altar` preview/prod deploy role ARNs. SSM is regional; the `us-east-1` certificate
  ARN is mirrored into `us-east-2` by the platform repo.
- **CI/CD:** **GitHub Actions** assumes the platform-provided `iron-altar-deploy-preview`
  or `iron-altar-deploy-prod` role via **GitHub OIDC**. No long-lived AWS access keys.
  `preview` deploys automatically; `main` deploys production after approval.
- **Mobile builds:** **EAS Build** production profile (`store` distribution), producing a
  signed `.ipa` and `.aab`. A manual/tag-triggered workflow archives them with version
  metadata and checksums in a private, versioned S3 release bucket owned by this app.
- **Publishing:** out of scope for P7.2. A future workflow can read a release from S3 and
  call `eas submit` (or the store CLIs). Apple/Google submission credentials stay in
  GitHub/EAS secrets, never in the artifact bucket.
- **Hostnames:** production is **`iron-altar.stevenclarke.dev`**; preview is
  **`iron-altar-preview.stevenclarke.dev`**. The platform-owned
  `stevenclarke.dev` + `*.stevenclarke.dev` certificate covers both. This app does not
  own the apex.

### Branch and environment model

| Environment | Branch    | Hostname                              | GitHub Environment             |
| ----------- | --------- | ------------------------------------- | ------------------------------ |
| Production  | `main`    | `iron-altar.stevenclarke.dev`         | `production` (manual approval) |
| Preview     | `preview` | `iron-altar-preview.stevenclarke.dev` | `preview` (auto-deploy)        |

Branch conventions:

- `main` — production; merges deploy after approval through the `production` Environment.
- `preview` — integration; merges auto-deploy the preview environment.
- `phase/<n>` or `phase/<n>-<description>` — plan-phase work (e.g., `phase/7-hosting`).
- `<issue-number>-<description>` — issue-driven work.

Open a PR into `main` for every change; CI (`.github/workflows/ci.yml`) must pass before
merge. See `AGENTS.md` for the full branching and PR workflow.

### Division of responsibilities

| Area                    | `stevenclarke-infrastructure`                                                                  | This repo                                                                                          |
| ----------------------- | ---------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- |
| DNS zone and delegation | Owns the `stevenclarke.dev` hosted zone, GoDaddy nameservers, and apex record                  | Reads the zone ID from SSM and creates its own `iron-altar` and `iron-altar-preview` alias records |
| TLS                     | Owns the shared apex + wildcard certificate in `us-east-1` and publishes the ARN               | Imports the shared certificate ARN; never requests or validates an app certificate                 |
| IAM and OIDC            | Owns the GitHub OIDC provider and `iron-altar-deploy-preview` / `iron-altar-deploy-prod` roles | Assumes its role in GitHub Actions; creates no users, roles, or OIDC provider                      |
| Shared network/data     | Owns the shared VPC and any shared database                                                    | None; this app is static and uses no VPC                                                           |
| App hosting             | None                                                                                           | Owns preview/prod S3 buckets, CloudFront distributions, cache/headers, and SPA fallback            |
| DNS records             | Grants scoped Route 53 record permission                                                       | Creates and updates only its own subdomain records                                                 |
| Mobile artifacts        | None                                                                                           | Owns the private, versioned mobile release bucket                                                  |
| Monitoring/budget       | Owns baseline alarms, budget, and alerts                                                       | May add app-specific alarms later; WAF is app-owned if added                                       |
| CI/CD                   | Deploys shared platform stacks only                                                            | Deploys this app’s infrastructure and content only                                                 |

### Platform contract

- Read shared values from SSM in **`us-east-2`**:
  - `/platform/dns/hosted-zone-id`
  - `/platform/dns/domain-name`
  - `/platform/certs/us-east-1/wildcard-arn` (mirrored into `us-east-2`)
  - `/platform/roles/iron-altar/preview/deploy-role-arn`
  - `/platform/roles/iron-altar/prod/deploy-role-arn`
- The platform onboarding guide is the source of truth for exact parameter names and CDK
  bootstrap details. The app uses the platform’s existing CDK bootstrap and qualifier; it
  does not run `cdk bootstrap`.
- `/platform/region` is planned but not yet published; this app pins `us-east-2` in
  `infra/config/environments.ts`.
- If CDK asset publishing requires role chaining, the platform grants the app deploy role
  explicit `sts:AssumeRole` access to the bootstrap roles rather than broad account admin.
- The app’s role trust is environment-scoped: `environment:preview` for the preview role
  and `environment:production` for the production role. The deploy workflows must run in
  the matching GitHub Environment.
- Each app role must include scoped Route 53 record changes, CloudFormation/CDK deployment,
  S3/CloudFront access, and any app-scoped SSM permissions used by the workflows. Missing
  permissions are a platform onboarding change, not a reason to broaden the role.
- The platform repo must be onboarded with this app’s repository name, hostnames, and
  role requirements before the first app deployment.
- The platform repo is not involved in application deployments; app workflows create
  their own DNS records and deploy their own stacks.

### App CDK layout

```
infra/
  bin/app.ts                       # app CDK entrypoint
  lib/static-site-stack.ts         # S3 + OAC + CloudFront + Route 53 alias
  lib/release-bucket-stack.ts      # private/versioned mobile artifact bucket
  config/environments.ts           # preview/prod names, hostnames, tags
  test/                            # CDK assertions / cdk-nag checks
  cdk.json
  package.json
```

- **Environment config:** define preview/prod stack names, hostnames, bucket names, tags,
  and SSM paths in `config/environments.ts`. Use `<app>-<environment>` naming to match the
  platform convention.
- **Static site stack:** parameterize one `StaticSiteStack` for preview and prod. Each stack
  creates its own S3 bucket, OAC, CloudFront distribution, cache/response-headers policies,
  SPA fallback, and Route 53 alias.
- **Preview/prod isolation:** separate stacks, buckets, distributions, and SSM outputs.
  Preview deploys from the `preview` branch; prod deploys from `main` after approval.
- **Site bucket:** block all public access, versioning on, SSE enabled, no static website
  endpoint. CloudFront uses OAC.
- **CloudFront:** default root `index.html`; custom 403/404 responses return `/index.html`
  with HTTP 200 for SPA deep links; HTTPS redirect; compression; security headers (HSTS,
  `X-Content-Type-Options`, `Referrer-Policy`; add CSP after testing if desired).
- **Certificate:** import the shared wildcard certificate ARN from the platform SSM
  contract. Do not request or validate a certificate in this repo.
- **DNS:** create A/AAAA alias records for `iron-altar.stevenclarke.dev` and
  `iron-altar-preview.stevenclarke.dev` in the shared hosted zone. Never modify the apex or
  another app’s records.
- **Caching:** hashed `/_expo/static/*` assets get long-lived immutable caching;
  `index.html` and `deployment.json` are `no-cache`; other files use a short cache.
- **Outputs:** publish app-owned bucket and distribution identifiers to app-scoped SSM
  parameters (for example `/apps/iron-altar/<environment>/...`) or expose them as
  CloudFormation outputs for the deploy workflows.
- **Rollback:** redeploy a previous commit. Site bucket versioning is a secondary safety
  net; a manual workflow can accept a commit SHA.
- **Release bucket:** private, versioned, encrypted, with lifecycle rules for incomplete
  multipart uploads only. Keep production mobile artifacts; do not upload signing keys or
  store credentials.
- **Cost and WAF:** preview and prod each add one bucket and distribution. Delete unused
  preview resources if the platform adopts a lifecycle policy. WAF is app-owned and
  deferred until needed.

### Deployment workflows

1. **PR checks** (`.github/workflows/ci.yml`, in place): Node 22 via `actions/setup-node`
   with npm cache, `npm ci`, `npm run format:check`, `npm run lint`, `npm run typecheck`,
   and `npm run build` (`expo export --platform web`). A tracked `src/types/expo.d.ts`
   references `expo/types` so typecheck works in CI without generated files. If `infra/`
   changed, also install its dependencies, run `npm run build`, `npx cdk synth`, and
   `cdk-nag`/unit tests. PR checks do not assume an AWS role or deploy.
2. **Preview deploy** (`preview.yml`, on push to `preview`, plus `workflow_dispatch` with a
   branch input): checks -> assume `vars.PREVIEW_DEPLOY_ROLE_ARN` in the `preview`
   Environment -> `npx cdk diff` -> deploy the preview static-site stack -> build/export the
   web app -> sync the preview bucket in three passes (immutable hashed assets, short-cache
   assets, no-cache `index.html`/`deployment.json`) -> invalidate the preview CloudFront
   distribution. This runs automatically.
3. **Production deploy** (`deploy.yml`, on push to `main`, plus `workflow_dispatch` with a
   branch input): checks -> require the GitHub `production` Environment approval -> assume
   `vars.DEPLOY_ROLE_ARN` -> `npx cdk diff` -> deploy the prod static-site stack ->
   export/sync/invalidate prod. Use concurrency groups so preview and prod deployments
   never overlap.
4. **Mobile archive** (`build-mobile.yml`, `workflow_dispatch` and/or `v*` tags): run
   `npx eas-cli@latest build --platform all --profile production --non-interactive --wait --json`,
   parse each build's `artifacts.applicationArchiveUrl` (fall back to
   `eas build:view <id> --json`), download the `.ipa`/`.aab`, compute SHA-256, upload the
   artifact and `metadata.json` to the app’s release bucket, then write the release
   manifest. (`eas build:download` is for simulator/emulator builds, not store artifacts.)
   Do **not** auto-submit to stores in this phase.
5. **Future publish workflow** (`publish-mobile.yml`): select a release by version/build
   from S3, download it, and run `eas submit --path ...` or the store CLIs. Requires
   App Store Connect API and Google Play service-account credentials stored as protected
   GitHub environment secrets or in EAS.

Use GitHub `preview`, `production`, and `mobile-release` environments, branch protection
requiring CI, and the platform-provided OIDC roles. This app creates no roles and assumes
only its own platform-provided app deploy roles; the platform repo is not involved in app
deployments.

### Version and artifact contract

- **User-facing version:** manually bump `expo.version` in `app.json` per release
  (`1.0.0`, `1.1.0`, ...). Git tag `v<version>` for a release.
- **Build versions:** set `cli.appVersionSource: "remote"` and
  `build.production.autoIncrement: true` in `eas.json`; EAS owns iOS `buildNumber` and
  Android `versionCode` and prevents duplicate store uploads.
- **Artifact layout** (immutable):
  ```
  mobile/<platform>/<version>/<buildNumber>/<artifact>
  mobile/<platform>/<version>/<buildNumber>/metadata.json
  mobile/manifest.json                  # generated after a successful both-platform run
  ```
  `metadata.json` records `version`, build number, EAS build ID, git SHA/ref, profile,
  creation time, original filename, SHA-256, and size. The `.ipa`/`.aab` are signed store
  artifacts; the bucket is private and encrypted.
- **Retention:** keep production artifacts indefinitely unless storage becomes a problem;
  use lifecycle rules for incomplete multipart uploads, not for release binaries.
- **Secrets:** never upload signing keys, `.p8`/`.p12` files, API keys, or service-account
  JSON to S3. EAS manages signing credentials (or they live in protected secrets).

### Confirmed decisions

1. **Production hostname:** `iron-altar.stevenclarke.dev`.
2. **Preview hostname:** `iron-altar-preview.stevenclarke.dev`.
3. **Domain and shared platform:** `stevenclarke-infrastructure` owns the Route 53 zone,
   GoDaddy nameserver delegation, apex record, shared wildcard certificate, OIDC provider,
   and per-app deploy roles.
4. **Bundle/package IDs:** `dev.stevenclarke.ironaltar` for both iOS and Android.
5. **Mobile build trigger:** `v*` tag push or manual workflow dispatch.
6. **Region:** `us-east-2` for app resources, S3 buckets, and SSM reads; the shared
   CloudFront certificate remains in `us-east-1`.
7. **Branches and environments:** pushes to `preview` deploy preview automatically; pushes
   to `main` deploy production after GitHub Environment approval.
8. **IaC:** **AWS CDK v2 in TypeScript** under this repo’s `infra/` directory; no
   Terraform. Shared platform resources remain in the platform repo.
9. **Ownership:** this repo creates its own S3 buckets, CloudFront distributions, Route 53
   alias records, app-scoped SSM outputs, and mobile release bucket. It creates no hosted
   zone, shared certificate, OIDC provider, or deploy role.
10. **TLS:** import the platform-owned wildcard certificate ARN from the region-local SSM
    contract; do not request app certificates.
11. **Hosting:** S3 + CloudFront + CDK. EAS Hosting is not part of the plan.
12. **Retention:** keep all production mobile artifacts indefinitely.
13. **Store publishing:** optional for now; Apple/Google accounts are not created yet, but
    the artifact layout keeps that path open.
14. **Artifact backfill:** start with the first production release; do not rebuild existing
    builds.

### Open decisions

1. **EAS plan/cost:** confirm the Expo/EAS account and whether the free tier is acceptable
   for build minutes; paid plans add concurrency and priority.
2. **Preview lifecycle:** whether the platform or app tears down idle preview stacks; this
   app should support teardown and redeploy without losing production data.

### Actions Steven must take

- [ ] Platform onboarding: confirm `iron-altar` is configured in
      `stevenclarke-infrastructure` with the preview/prod hostnames, deploy roles, and SSM
      parameters published, and that the platform stacks are deployed.
- [ ] GitHub: protect `preview` and `main`, require CI, create `preview`, `production`, and
      `mobile-release` environments, and approve OIDC trust for this repository.
- [ ] Expo/EAS: create/sign in to the Expo account, run `eas init` (or provide the project
      ID), choose an EAS organization, and create an `EXPO_TOKEN` for GitHub Actions.
- [ ] Apple (optional, only if publishing): enroll in the Apple Developer Program, accept
      agreements, create the App Store Connect app record, and create an App Store Connect
      API key for future submissions.
- [ ] Google (optional, only if publishing): create the Play Console app record, complete
      developer verification, and create a service account with Play Developer API access
      for future submissions.
- [ ] Store assets (optional, after deciding to publish): privacy policy URL, support URL,
      screenshots, descriptions, data-safety/app-privacy answers, content rating, and
      encryption/export-compliance declaration.
- [ ] Confirm EAS-managed signing is acceptable; otherwise provide existing Android
      keystore and iOS distribution credentials.
- [ ] After the first production deploy, link `iron-altar.stevenclarke.dev` from the
      portfolio; optionally link the preview URL internally.

### Implementation sequence

1. **Platform prerequisites:** confirm the platform repo has deployed the hosted zone,
   shared certificate, OIDC provider, and `iron-altar` preview/prod roles, and published
   the SSM contract. Do not run `cdk bootstrap` from this repo.
2. **Scaffold app infra:** add `infra/` as a CDK v2 TypeScript project with environment
   config, naming/tags, `cdk-nag`, and tests.
3. **Static site stacks:** implement the preview and prod `StaticSiteStack` instances:
   import the shared hostname/zone/cert values, create private S3 buckets, OAC, CloudFront,
   Route 53 aliases, cache/header behavior, SPA fallback, and app-scoped outputs.
4. **Preview first:** deploy the preview stack, run the first export/sync, and verify DNS,
   HTTPS, SPA deep links, headers, caching, and rollback before touching production.
5. **Automate:** add the automatic `preview` deploy and the approved `main` production
   deploy (PR checks already live in `.github/workflows/ci.yml`). Verify a failed check
   blocks deployment and concurrency is locked.
6. **Production:** merge to `main`, approve, deploy, and verify the production hostname.
7. **Mobile:** add `eas.json`, identifiers, remote version source, production profile, and
   signing; deploy the release bucket; run the mobile archive workflow and verify the
   artifact + metadata layout.
8. **Launch:** add P7.3 polish, privacy/support pages, and store metadata. Build the future
   `publish-mobile.yml` only when ready to submit.

**Out of scope for P7.1/P7.2:** platform DNS, GoDaddy delegation, shared certificates, OIDC
roles, VPC/shared database, the portfolio app, PR-ephemeral previews, multi-region, WAF,
OTA updates, account sync, store auto-submission, and a custom backend.

## 8. Google SSO Onboarding (P9)

Integration contract: `../stevenclarke-infrastructure/docs/google-sso-for-tenant-apps.md`.
The platform owns the shared Cognito user pool, Google IdP, Hosted UI domain,
`/platform/auth/*` SSM parameters, and the scoped deploy-role permissions. Iron Altar owns
one public app client per environment, the sign-in/callback/logout routes, session handling,
claim validation, and the CSP. No second user pool or Google OAuth client exists.

Implemented in `infra/lib/static-site-stack.ts`, `src/auth/`, `src/state/auth-store.ts`,
`src/app/{welcome,auth/callback,logout}.tsx`, `src/ui/account-panel.tsx`, and the deploy
workflows. Setup and troubleshooting live in `docs/google-sso.md`.

**Phase 9.1 ships the landing gate:** the optional in-app `/login` entry is replaced by
`/welcome`. Google remains optional, but every app route is guarded until the user chooses
Google or anonymous. Sign-out returns to the gate.

**Phase 9.2** adds an explicit consent confirmation before Google sign-in so the user
approves email sharing, and a Profile **User ID** row showing the Google email or `anonymous`.

### Platform values consumed (not hardcoded)

| SSM parameter                  | Use                                                    |
| ------------------------------ | ------------------------------------------------------ |
| `/platform/auth/user-pool-id`  | Imported to create the app's `UserPoolClient`          |
| `/platform/auth/user-pool-arn` | Referenced by the platform's scoped deploy-role policy |
| `/platform/auth/domain`        | Hosted UI authorize/token/logout endpoints and CSP     |
| `/platform/auth/issuer`        | ID token `iss` validation and runtime config           |
| `/platform/auth/jwks-uri`      | Web RS256 signature verification and CSP `connect-src` |

The app does not write a client-ID SSM parameter: app deploy roles only have
`ssm:GetParameter`. The client ID is the site stack's `AuthClientId` output, which the
workflow reads from `cdk-outputs.json`.

### Redirect matrix

| Surface | Environment         | Redirect URI                                                             |
| ------- | ------------------- | ------------------------------------------------------------------------ |
| Web     | prod                | `https://iron-altar.stevenclarke.dev/auth/callback`                      |
| Web     | preview             | `https://iron-altar-preview.stevenclarke.dev/auth/callback`              |
| Web     | local dev           | `http://localhost:8081/auth/callback` (+ `127.0.0.1`)                    |
| Native  | dev build / release | `ironaltar://auth/callback`                                              |
| Expo Go | —                   | unsupported: `exp://` host/port is unstable and cannot be pre-registered |

Prod carries the prod web URL and native scheme. Preview additionally carries localhost and
loopback URLs. Cognito supports custom URI schemes and loopback HTTP for local development.

### Landing gate and entry flow (Phase 9.1)

| State     | Persistence                                                                                                              | Route access                                                                           |
| --------- | ------------------------------------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------- |
| No entry  | None                                                                                                                     | Only `/welcome` and `/auth/callback` render; every other route redirects to `/welcome` |
| Anonymous | `localStorage` on web, SecureStore on native; no Google tokens                                                           | Full app                                                                               |
| Google    | Native: SecureStore session restores on launch. Web: memory-only, so reload clears the session and returns to `/welcome` | Full app; re-signing in reuses the shared Cognito session                              |
| Sign-out  | Clears the anonymous marker, Google tokens, and pending PKCE state; Google sign-out also ends the shared Cognito session | Returns to `/welcome`                                                                  |

- `/login` is removed; `/welcome` is the landing page. Existing `/auth/callback` and logout
  routes keep their registered URLs.
- The root layout uses `Stack.Protected` and `unstable_settings.anchor = 'welcome'`.
  Deep links without an entry land on `/welcome`; browser back to `/welcome` after entry
  redirects to `/`.
- Splash stays visible until auth hydration finishes so a restored native session does not
  flash the landing page.
- Anonymous is a local identity mode only: the same local database, profile, and XP rules
  apply. No per-mode data separation, backend, or sync is introduced.
- The Account panel shows **Anonymous** or the Google identity and offers sign-out. There is
  no in-app mode switch; signing out returns to the gate.

### Config delivery

- Deploy workflows read `/platform/auth/*` and the stack's `AuthClientId`/`SiteUrl`
  outputs, write `dist/auth-config.json`, then sync it to S3 with no-cache metadata. No
  rebuild is needed when the platform rotates its domain; no secrets are involved.
- Local dev uses the preview client via `EXPO_PUBLIC_AUTH_*` env vars (`.env.example`).
- Native builds receive the same values through `EXPO_PUBLIC_AUTH_*` at build time; there
  is no runtime config fetch on native.

### Session and token strategy

| Surface | Storage                                     | Renewal                                                                                                                 |
| ------- | ------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| Web     | ID/access tokens in memory only             | Manual sign-in reuses the shared Cognito session, so Google usually does not prompt; no refresh token in `localStorage` |
| Native  | Refresh token + ID/access in SecureStore    | Refresh before expiry; restore on launch; clear all on sign-out                                                         |
| Both    | Clear local session, then Cognito `/logout` | `logout_uri` ends the shared Cognito session; Phase 9.1 returns to `/welcome` with Google or anonymous entry            |

Validate `iss`, `aud` (client ID), `exp`, `token_use`, and `email_verified`. Web verifies
the RS256 signature against JWKS with `jose`; native validates claims only because Hermes
lacks WebCrypto. Google sign-in is identity-only: no sync and no feature gating beyond the
Phase 9.1 landing gate. Under 9.1, a web Google reload still returns to `/welcome` because
tokens stay memory-only; anonymous entry persists. Native restores either mode.

### CSP

The CloudFront response headers policy now sends:

```
default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline';
font-src 'self' data:; img-src 'self' data: https://*.googleusercontent.com;
connect-src 'self' https://<auth-domain> https://cognito-idp.<region>.amazonaws.com;
form-action 'self' https://<auth-domain> https://accounts.google.com;
frame-ancestors 'none'; base-uri 'self'; object-src 'none'
```

The auth domain is resolved from SSM at synth time and asserted in CDK tests. Token
exchange CORS was verified against the deployed Hosted UI domain.

### Verification

- Platform checklist: sign-in from prod and preview completes on the exact registered URIs;
  the shared Cognito session reuses SSO; state mismatch and missing PKCE are rejected; wrong
  issuer/audience is rejected; sign-out clears the app and Cognito sessions; no tokens in
  URLs, logs, or `localStorage`.
- App checklist: web callback returns to `/`; cancel/error returns to `/welcome` with
  anonymous entry available; native deep link works in a development build; relaunch restores
  the entry mode; CSP does not block token/JWKS/avatar requests; preview then prod.
- Landing gate (Phase 9.1): direct links to protected routes redirect to `/welcome`;
  `/auth/callback` still completes; anonymous survives web reload and native relaunch; web
  Google reload returns to `/welcome`; sign-out from either mode resets to `/welcome`; browser
  back does not re-enter the app; no landing flash on a restored native session.
- Consent and identity (Phase 9.2): in-app consent appears before the Google redirect and
  Google entry still completes; Profile **User ID** shows the Google email after Google entry
  and `anonymous` after anonymous entry; both web and development build.

### Google Cloud test users (platform-owned)

The Google OAuth client belongs to the platform's Google Cloud project. Its client ID is
`279862640725-co9t4uufugkp8rklh4vatc63ve08scr1`, so the project number is `279862640725`.
To test sign-in while the consent screen is in **Testing**:

1. Sign in to [Google Cloud Console](https://console.cloud.google.com/) with the account that
   owns the platform project and select the project numbered `279862640725`.
2. Open **Google Auth Platform → Audience** (older UI: **APIs & Services → OAuth consent
   screen**).
3. Under **Test users**, add the exact Google account used to test Iron Altar.
4. Confirm the publishing status is **Testing** and the user type is **External**. If the
   user type is **Internal**, only Workspace-org accounts can sign in; switch to External or
   use an org account.
5. Do not create another OAuth client; the platform owns the only one.

### Open decisions

1. Web session durability: in-memory + shared Cognito re-auth (P9) vs. a small BFF for
   HttpOnly refresh cookies. A BFF is out of scope until sync exists.
2. Native signature verification: claim-only (P9) vs. adding a WebCrypto polyfill.
3. Web Google reload under the Phase 9.1 gate returns to `/welcome` by design. Silent
   `prompt=none` re-auth or a BFF can remove that step later; anonymous already persists.
4. Consent delivery (Phase 9.2): the classic Hosted UI drops `prompt=consent`, so the app now
   shows its own confirmation. Migrate the shared pool to managed login if Google's consent
   screen must appear; keep `email profile` scopes or narrow to `email` once profile usage is
   confirmed.

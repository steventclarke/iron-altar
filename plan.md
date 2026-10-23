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
  keep an auth/sync seam so federated login (Apple/Google) and cloud sync can be added later.

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
  domain/                 # types + pure logic (XP, volume, 1RM, stage calc, units)
  data/                   # db, repositories, migrations, seed, auth/sync seam
  state/                  # zustand stores
  ui/                     # components, theme, pixel primitives, avatar
  art/                    # sprite-sheet format + character registry
  constants/theme.ts      # design tokens
assets/                   # fonts, sprite sheets
```

**Auth/sync seam:** all reads/writes go through repositories. A `SyncAdapter` interface
(no-op in v1) sits behind them so a remote backend + login can be slotted in later without
touching UI.

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

## 5. Phases / Milestones

- **P0 Scaffold:** Expo + TS init, Expo Router, lint/format, tsconfig paths, theme tokens,
  pixel font, base UI primitives, skeleton routes. Runs on iOS/Android/web.
- **P1 Data (done):** versioned JSON document + migrations, repositories (profile,
  exercise, session, body weight, draft), seed exercises (5 main lifts + accessories),
  SyncAdapter seam, Zod-free typed stores on repositories, unit conversion, and persisted
  active/draft session (refinement #2 prerequisite). Tests deferred to a later phase.
- **P1.1 Session Entry Date (done):** `Session.date` becomes the user-chosen performed
  calendar day (`YYYY-MM-DD`) with `startedAt`/`endedAt` now optional (live sessions only);
  `DraftSession` carries the entry date; `DB_VERSION` → 2 with a migration normalizing legacy
  dates; repository sorts by performed date; store gains `start(date?)` + `setEntryDate`
  (refinement #3 data model — prerequisite for retroactive workouts in P3).
- **P2 Profile + Avatar (done):** character registry, avatar component, sprite-sheet loader,
  stage calc, profile screen.
- **P3 Session Log (done):** exercise picker (main lifts + accessories), set entry
  (weight/reps/warmup/notes), rest timer (presets 60/90/120/180s, auto-start on set,
  survives navigation), validation, Resume affordance on the Session page (#2), and
  retroactive date control on the session screen over the P1.1 entry-date model (#3).
  Duplicate-set button: per-set `2X` + "Repeat Last Set" (#1).
- **P3.1 Session Log Refinements (done):** follow-up pass on the session screen from PO
  review — configurable minute/second rest timer with persistence (#8), navigation back to
  gym/history (#9), unit-aware tonnage (#10), sets grouped by exercise (#11), editable
  logged reps (#12), and same-weight sets collapsed to one row (#13). Structural items
  (rest-timer persistence, `updateSet`) land before the layout items that build on them.
- **P4 History (done):** list + detail view. Render retroactively-dated sessions (#3).
- **P5 Data Viz (done):** custom SVG pixel chart components, per-lift and body-weight
  screens, manual body-weight entry, and the per-exercise working-set aggregation seam
  (#6).
- **P5.1 Demo Visual Consistency (done):** locked top navigation on every screen — bottom
  tab bar hidden, `Screen` gains a fixed `header` slot, and `NavBar` highlights the active
  tab (#7, pulled forward from P7 for the demo); rest-timer stepper arrow glyphs fixed
  (#15).
- **P6 Gamification & Animations (done):** weekly streak + XP decay from the manual performed
  date (`Profile.lastActivityDate`, `DB_VERSION` → 4), trend indicator, XP-to-next-stage bar,
  set-complete flash, and a workout-complete overlay with avatar growth. Animations use React
  Native `Animated` (native driver off on web) so no extra dependency is needed. Streak/decay
  now follow backdated workouts (#3); working-set counts feed the Profile stats and per-exercise
  seam (#6).
- **P6.1 Session Log & XP Refinements (done):** rest timer moved to its own `/rest-timer`
  screen (#16); reps edit field constrained to two digits and left-aligned (#17, #18); XP
  switched from tonnage to 1 per working set, with a DB v5 rebuild of stored session/profile
  totals (#19).
- **P6.2 Session/Profile IA & Stats (done):** `/` is a lean Session entry screen containing
  only Start/Resume Workout, with the avatar and training summary exclusively on Profile (#20);
  "Log Past Workout" is removed in favor of the session date selector (#21); body weight is
  editable on Profile (#22); "Decaying" only appears after a full week without training (#23).
- **P7 Hosting & Ship (next):**
  - **P7.1 Hosting & domain platform:** dedicated **AWS CDK v2 (TypeScript)** infrastructure
    project; public Route 53 zone delegated from GoDaddy; shared apex + wildcard ACM
    certificate; per-app S3/CloudFront stacks; GitHub OIDC deployment on push to `main`;
    SPA fallback, cache/security headers, deployment metadata, and rollback path. See
    section 7.
  - **P7.2 Mobile release archive:** EAS production builds for iOS/Android; upload signed
    `.ipa`/`.aab` plus version metadata and SHA-256 checksums to a private, versioned,
    CDK-managed S3 bucket. Store submission remains a future workflow.
  - **P7.3 Polish & launch:** responsive web, accessibility, empty states, privacy/support
    pages, store listing metadata, and text-file import (#4, post-MVP candidate).

## 6. Feature Refinements (triaged)

Efficiency rule: fold **structural** items (data model, domain, persistence, architecture)
in as early as possible; defer **experiential** items (polish, feel, copy) until the feature
can actually be used. Each phase pulls in the refinements that intersect its surface area.

| #   | Refinement                                                                                                                                                                              | Phase                                                           | Notes                                                                                                                                                                                                                                                                                                                                              |
| --- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | Duplicate-set button: re-log a set with the same weight x reps without re-entering.                                                                                                     | **P3** (Session Log) — copy shipped, glyph to change            | Operates on the existing `SetEntry` shape — no schema/domain change. Shipped as per-set `2X` plus a "Repeat Last Set" button. Follow-up: replace the `2X` glyph with `+` — `2X` reads as a set-count/multiplier and is confusing.                                                                                                                  |
| 2   | In-progress session survives leaving the screen, so the user can check prior sessions and return.                                                                                       | **P1** (persist) + **P3** (UX) — shipped                        | Structural. Phase A (P1): persist the draft session instead of the in-memory `useSessionStore`, so it survives navigation and app restart. Phase B (P3): Resume affordance on the Session page + return to the active session.                                                                                                                     |
| 3   | Log retroactive workouts for prior dates.                                                                                                                                               | **P1.1** (data) + **P3** (UX) + **P6** (streak/decay) — shipped | Structural. P1.1 shipped the data model: `Session.date` is the performed calendar day, `startedAt`/`endedAt` are optional (live only), and the draft/store carry a settable entry date. P3 shipped the session date stepper (the Gym shortcut was removed by #21). P4 renders it in History; P6 computes weekly streak/decay from performed dates. |
| 4   | Import workout data from a text file.                                                                                                                                                   | **P7** (post-MVP candidate)                                     | Needs a documented import format (CSV/JSON), a bulk-insert repository method with de-dupe, and platform file pickers (web input vs native document picker). Defer until the data model is stable; scope risk vs the Nov MVP. Doubles as a backfill path for #3.                                                                                    |
| 5   | Rename "Dungeon Gym" to "Iron Altar" and center the screen title.                                                                                                                       | **Superseded by #20**                                           | The Gym page becomes the Session page (#20), so its tab/heading should read "Session" rather than "Iron Altar"; the app name can live in Profile or landing copy.                                                                                                                                                                                  |
| 6   | XP should be based on the count of **working sets** (non-warmup), and we should track working sets **per exercise** so progress can be shown per lift, not just as one number.          | **P5** (Data) + **P6.1** (Gamification) — shipped               | Structural: `workingSetsByExercise(sets)` lives in `src/domain/progress.ts` and drives per-lift charts. P6 added lifetime working-set counts to Profile stats; P6.1 switched XP to 1 per working set.                                                                                                                                              |
| 7   | Move the navigation bar to the top and lock it so it stays visible while scrolling.                                                                                                     | **P5.1** (Demo) — shipped                                       | Implemented as a persistent `NavBar` in `Screen`'s new fixed `header` slot on every screen, with the bottom tab bar hidden. The bar highlights the active section and uses `navigate` so tabs focus instead of stacking.                                                                                                                           |
| 8   | User-definable rest timer in minutes **and** seconds via up/down steppers; default 1:00; persist the chosen value across sessions.                                                      | **P3.1** (Session Log follow-up)                                | Structural (persistence) + experiential (controls). Replace the fixed 60/90/120/180 presets with a minute/second stepper, default 1:00, and persist the chosen duration (extend the draft/document store, not just ephemeral `rest-timer-store`). Main use case is long strength rests (~5:00).                                                    |
| 9   | Navigation bar on the Session Log page so the user can return to the gym or session history to reference past sessions.                                                                 | **P3.1** (Session Log follow-up)                                | Experiential: expose tab navigation (or in-screen links) on `session/[id]`, which currently sits outside the tab navigator. Depends on #7's navigator decision so the two agree on top vs bottom placement.                                                                                                                                        |
| 10  | Use the user-selected unit of measure for the tonnage total on the Session Log page.                                                                                                    | **P3.1** (Session Log follow-up)                                | Small: `totalVolumeKg` is already computed; format it with `formatWeight(..., unitPref)` (or the stone/kg/lb display helpers) instead of raw kg. Bug-level polish on the session screen.                                                                                                                                                           |
| 11  | Group logged sets by exercise on the Session Log page.                                                                                                                                  | **P3.1** (Session Log follow-up)                                | Experiential layout: render the flat `active.sets` list grouped by `exerciseId` (ordered by main lift then accessories), instead of one continuous list. Pairs with #12/#13.                                                                                                                                                                       |
| 12  | Allow editing the reps of a logged set (e.g. duplicate a set, then edit reps down after a missed rep).                                                                                  | **P3.1** (Session Log follow-up)                                | Structural: add an `updateSet(setId, patch)` action to `session-store` (+ a draft commit) and an editable reps control in the set row. Extends the duplicate-set (#1) workflow.                                                                                                                                                                    |
| 13  | Within an exercise, group logged sets of identical weight onto one row (e.g. `225 x 5, 5, 4`).                                                                                          | **P3.1** (Session Log follow-up)                                | Experiential layout over the grouped view (#11): collapse same-`weightKg` sets into a single row showing a comma-separated reps list. Pure presentation; no schema change (reps remain individual `SetEntry` rows).                                                                                                                                |
| 14  | Use `+` instead of `2X` for the duplicate-set control.                                                                                                                                  | **P3.1** (Session Log follow-up)                                | Copy/label fix on #1: `2X` is confusing because it reads as a set count/multiplier rather than "add a set". Swap the per-set glyph to `+`. No behavior change.                                                                                                                                                                                     |
| 15  | Rest-timer minute/second steppers show literal `\u25B2` / `\u25BC` text instead of up/down arrows.                                                                                      | **P5.1** (Demo) — shipped                                       | Bug: JSX string attributes don't process escape sequences, so the arrows rendered as literal backslash text. Use the actual `▲` / `▼` characters.                                                                                                                                                                                                  |
| 16  | Move the rest timer to its own screen to declutter the session log.                                                                                                                     | **P6.1** — shipped                                              | New `/rest-timer` route reuses the persisted timer store; the session log keeps a single launch button.                                                                                                                                                                                                                                            |
| 17  | Make the reps edit box only two digits wide so it no longer overflows when 3+ sets are logged.                                                                                          | **P6.1** — shipped                                              | Fixed-width input plus a flexible, wrapping reps row keeps long set groups inside the panel.                                                                                                                                                                                                                                                       |
| 18  | Left-align the reps edit box instead of centering its text.                                                                                                                             | **P6.1** — shipped                                              | `textAlign: 'left'` on the reps input.                                                                                                                                                                                                                                                                                                             |
| 19  | XP should be 1 per working set per exercise, not based on tonnage.                                                                                                                      | **P6.1** — shipped                                              | `xpFromSet` now returns 1 for non-warmups; DB v5 rewrites stored session XP and rebuilds profile XP from working-set totals.                                                                                                                                                                                                                       |
| 20  | The Gym and Profile pages duplicate the avatar and training summary. Make the Gym page a lean Session page with only Start/Resume Workout; keep the avatar and summary on Profile only. | **P6.2** (Session/Profile IA & Stats) — shipped                 | Experiential IA cleanup. `/` keeps Start Workout (or Resume when a draft exists) and drops the avatar, XP/streak/trend, and last-trained panels. Profile owns that content. The GYM tab/heading now reads SESSION; this supersedes #5.                                                                                                             |
| 21  | Remove the "Log Past Workout" button; retroactive logging can start from Start Workout and use the session date selector.                                                               | **P6.2** (Session/Profile IA & Stats) — shipped                 | Start Workout opens the session log, where `EntryDateStepper` already sets a past performed date (P3/#3). The redundant entry point is gone.                                                                                                                                                                                                       |
| 22  | Make body weight editable on the Profile page.                                                                                                                                          | **P6.2** (Profile stats) — shipped                              | Add a weigh-in editor to Profile's training panel in preferred units. The latest entry is updated in place via `bodyWeightRepository.update`; with no history, the first entry is added. Progress keeps the chart/history and dated entries.                                                                                                       |
| 23  | The trend should only say "Decaying" once a week or more has passed since the last logged workout.                                                                                      | **P6.2** (Gamification) — shipped                               | `trainingSummary` no longer compares recent XP with weekly decay. `down` is gated on `weeksSince(lastTrainingDate) >= 1`; otherwise `up` when the latest week has training XP and `flat` with no sessions.                                                                                                                                         |
| 24  | Use **AWS CDK in TypeScript** for all infrastructure as code.                                                                                                                           | **P7.1** (Hosting) — planned                                    | Structural. Replaces Terraform. A dedicated CDK app owns the shared Route 53 zone, apex + wildcard ACM certificate, GitHub OIDC roles, and per-app static-site stacks. Portfolio and Iron Altar each get their own S3/CloudFront distribution; app repos only deploy content.                                                                      |

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
- **P7 Hosting & Ship:** P7.1 AWS CDK web/domain platform + GitHub Actions (#24); P7.2 EAS
  mobile artifacts archived to versioned S3; P7.3 responsive web, accessibility, empty
  states, privacy/support pages, store listing metadata, and text-file import (#4) —
  post-MVP candidate; confirm format before building.

## 7. Hosting & Release Infrastructure (P7.1/P7.2)

### Recommendation

- **Web:** private **S3** origin served through **CloudFront** (Origin Access Control),
  with **Route 53** DNS and an **ACM** certificate. This keeps the app on AWS, is cheap at
  portfolio traffic levels, and gives full control over caching, headers, and rollback.
- **Infrastructure as code:** **AWS CDK v2 in TypeScript**, in a dedicated
  `stevenclarke-infra` project rather than the portfolio or app repo. CDK bootstraps each
  account/region once and uses CloudFormation for state; there is no Terraform backend.
- **Ownership:** the platform CDK app owns the Route 53 zone, apex + wildcard ACM
  certificate, DNS records, GitHub OIDC roles, and shared constructs. The portfolio and
  each application are separate `StaticSiteStack` instances with their own S3 bucket and
  CloudFront distribution. App repositories only build content and deploy it; they do not
  create shared DNS or certificate resources.
- **CI/CD:** **GitHub Actions** with **GitHub OIDC -> AWS IAM roles**. No long-lived AWS
  access keys in GitHub. App pushes deploy content; infrastructure changes run
  `cdk diff`/`cdk deploy` from the infrastructure workflow.
- **Mobile builds:** **EAS Build** production profile (`store` distribution), producing a
  signed `.ipa` and `.aab`. A manual/tag-triggered workflow archives them with version
  metadata and checksums in a private, versioned, CDK-managed S3 release bucket.
- **Publishing:** out of scope for P7.2. A future workflow can read a release from S3 and
  call `eas submit` (or the store CLIs). Apple/Google submission credentials stay in
  GitHub/EAS secrets, never in the artifact bucket.
- **Domain:** **`iron-altar.stevenclarke.dev`** (confirmed). GoDaddy remains the registrar;
  CDK creates the `stevenclarke.dev` Route 53 hosted zone, then the nameservers are
  delegated once at GoDaddy. The apex serves the portfolio; each app gets its own
  subdomain. Use `us-east-1` for ACM (required by CloudFront) and the AWS resources.

### Target AWS CDK layout

```
stevenclarke-infra/
  bin/infra.ts                    # CDK app entrypoint
  lib/platform/dns-stack.ts       # Route 53 zone, migrated MX/TXT/apex records
  lib/platform/cert-stack.ts      # us-east-1 stevenclarke.dev + *.stevenclarke.dev
  lib/platform/oidc-stack.ts      # GitHub OIDC provider + scoped deploy roles
  lib/apps/portfolio-stack.ts     # apex S3 + CloudFront
  lib/apps/iron-altar-stack.ts    # iron-altar S3 + CloudFront
  lib/constructs/static-site.ts   # shared S3/OAC/CloudFront/alias/cache/header setup
  test/                           # CDK assertions / cdk-nag checks
```

- **Deployment sequence:** deploy `DnsStack`, copy existing GoDaddy records, delegate the
  nameservers at GoDaddy, verify public resolution, then deploy `CertStack` (ACM DNS
  validation) and the app stacks. Requesting the certificate before delegation would leave
  validation pending.
- **Shared certificate:** one `us-east-1` certificate for `stevenclarke.dev` +
  `*.stevenclarke.dev`, reused by every CloudFront distribution in the account. The
  wildcard covers one subdomain level; nested names such as
  `api.iron-altar.stevenclarke.dev` would need another certificate or a different name.
- **App stack per site:** each app is an independent CloudFront distribution with its own
  cache policy, response-headers policy, SPA fallback, logging, and invalidation. Do not
  multiplex all apps behind one distribution unless a shared deployment/cache model is
  explicitly wanted.
- **Portfolio at the apex:** use a Route 53 alias A/AAAA record to CloudFront (CNAME is not
  valid at the zone apex). Its certificate must include `stevenclarke.dev`; the shared
  apex + wildcard certificate does.
- **Adding an app:** add another `StaticSiteStack` with its subdomain and bucket, deploy,
  then add its URL to the portfolio. App CI receives only the bucket/distribution details
  it needs.
- **Separate accounts later:** if an app moves to another AWS account, it needs its own
  `us-east-1` certificate and CloudFront distribution; the platform CDK app still owns the
  parent DNS record pointing at it.

- **Site bucket:** block all public access, versioning on, SSE enabled, no static website
  endpoint. CloudFront uses OAC.
- **CloudFront:** default root `index.html`; custom 403/404 responses return `/index.html`
  with HTTP 200 for SPA deep links; HTTPS redirect; compression; security headers
  (HSTS, `X-Content-Type-Options`, `Referrer-Policy`; add CSP after testing if desired).
- **Caching:** hashed `/_expo/static/*` assets get long-lived immutable caching;
  `index.html` and `deployment.json` are `no-cache`; other files use a short cache.
- **Rollback:** redeploy a previous commit (site bucket versioning provides a secondary
  safety net). A manual workflow dispatch can accept a commit SHA for emergency rollback.
- **SSM outputs:** CDK publishes bucket names, CloudFront distribution ID, and hosted URL
  to Parameter Store so app deploy workflows do not need CloudFormation/CDK access.
- **AWS baseline:** root MFA, IAM Identity Center (no root use), CloudTrail, and an AWS
  Budget with alerts (e.g. $10/month) before exposing the app.

### Deployment workflows

1. **App PR CI** (`ci.yml` in the app repository): Node 24 via `actions/setup-node` with
   npm cache, `npm ci`, formatting check, `tsc --noEmit`, Expo lint, and
   `expo export -p web` (upload the export only as a temporary CI artifact if useful).
2. **Infra validation** (pull request workflow in `stevenclarke-infra`): Node 24,
   `npm ci`, `npm run build`, `npx cdk synth`, `npx cdk diff`, and optional `cdk-nag`
   checks, using a read-only diff role via GitHub OIDC.
3. **Infra deploy** (`deploy-infra.yml`, on push to `main` or manual dispatch): assume the
   infra role -> `npx cdk diff` -> `npx cdk deploy --all --require-approval never` (or
   deploy selected stacks). The initial DnsStack deploy and GoDaddy nameserver change are
   manual; see the implementation sequence.
4. **App deploy** (`deploy.yml`, on push to `main`): checks -> assume the app deploy role ->
   `expo export -p web` -> sync files in three passes: hashed `/_expo/static/*` with
   `immutable`, other assets with a short cache, and `index.html`/`deployment.json` with
   `no-cache`; delete removed assets -> invalidate CloudFront `/*`. Use a concurrency group
   so two deploys never overlap. The first deploy is run manually after bootstrap;
   subsequent pushes are automatic.
5. **Mobile archive** (`build-mobile.yml`, `workflow_dispatch` and/or `v*` tags): run
   `npx eas-cli@latest build --platform all --profile production --non-interactive --wait --json`,
   parse each build's `artifacts.applicationArchiveUrl` (fall back to
   `eas build:view <id> --json`), download the `.ipa`/`.aab`, compute SHA-256, upload the
   artifact and `metadata.json` to S3, then write the release manifest. (`eas build:download`
   is for simulator/emulator builds, not store artifacts.) Do **not** auto-submit to stores
   in this phase.
6. **Future publish workflow** (`publish-mobile.yml`): select a release by version/build
   from S3, download it, and run `eas submit --path ...` or the store CLIs. Requires
   App Store Connect API and Google Play service-account credentials stored as protected
   GitHub environment secrets or in EAS.

Use GitHub `production` / `mobile-release` environments, branch protection requiring CI,
and OIDC trust policies restricted to this repository and `refs/heads/main` (or the mobile
release tag). Separate roles keep app deploys, CDK/infra changes, and artifact writes scoped.

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

1. **Hostname:** `iron-altar.stevenclarke.dev`.
2. **Domain:** GoDaddy remains the registrar; CDK creates the `stevenclarke.dev` Route 53
   hosted zone, followed by a one-time nameserver delegation at GoDaddy. The portfolio
   owns the apex; each app gets its own subdomain.
3. **Bundle/package IDs:** `dev.stevenclarke.ironaltar` for both iOS and Android.
4. **Mobile build trigger:** `v*` tag push or manual workflow dispatch.
5. **Region:** `us-east-1` for ACM/CloudFront and both S3 buckets.
6. **Web deploy trigger:** every push to `main`, after checks pass.
7. **IaC:** **AWS CDK v2 in TypeScript** in a dedicated infrastructure project; no
   Terraform.
8. **Ownership:** the platform CDK app owns the shared Route 53 zone, apex + wildcard ACM
   certificate, DNS records, and OIDC roles. The portfolio and each app have their own
   S3/CloudFront distribution; app repos only deploy content.
9. **Hosting:** S3 + CloudFront + CDK. EAS Hosting is not part of the plan.
10. **Retention:** keep all production mobile artifacts indefinitely.
11. **Store publishing:** optional for now; Apple/Google accounts are not created yet, but
    the artifact layout keeps that path open.
12. **Artifact backfill:** start with the first production release; do not rebuild existing
    builds.

### Open decisions

1. **EAS plan/cost:** confirm the Expo/EAS account and whether the free tier is acceptable
   for build minutes; paid plans add concurrency and priority.
2. **Repo topology:** use a separate `stevenclarke-infra` repository (recommended) or an
   `infra/` top-level project in a monorepo.

### Actions Steven must take

- [ ] AWS: enable root MFA, create an admin via IAM Identity Center, enable CloudTrail,
      create a budget alert, and confirm the target account ID (`us-east-1`).
- [ ] DNS/domain: inventory the current GoDaddy records (MX/TXT/A/CNAME, including the
      portfolio), approve creating the Route 53 hosted zone, and update the GoDaddy
      nameservers once the zone’s four NS records are ready. Keep domain lock and 2FA on.
- [ ] GitHub: protect `main`, require CI, create `production` and `mobile-release`
      environments, and approve OIDC trust for the app and infrastructure repositories.
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
- [ ] After the first web deploy, link the hosted URL from the portfolio; optionally add
      `deployment.json`/commit SHA to the portfolio’s project notes.

### Implementation sequence

1. **CDK bootstrap:** create the dedicated `stevenclarke-infra` TypeScript project, then run
   `npx cdk bootstrap` once for the target account/region. Add the GitHub OIDC stack and IAM
   roles.
2. **DNS:** deploy `DnsStack` to create the public hosted zone, migrate the existing GoDaddy
   records, set the four Route 53 nameservers at GoDaddy, and verify public resolution.
3. **Web platform:** deploy `CertStack` (apex + wildcard certificate), then the
   `StaticSiteStack` for the portfolio and Iron Altar. Validate HTTPS, apex/subdomain
   aliases, SPA deep links, headers, and cache behavior. Run the first export/sync manually.
4. **Automate:** add CDK synth/diff/deploy workflows and the app deploy workflow; verify a
   push to `main` updates S3/CloudFront and a failed check blocks deploy.
5. **Mobile:** add `eas.json`, identifiers, remote version source, production profile, and
   signing; create the CDK release bucket; run the mobile archive workflow and verify the
   artifact + metadata layout.
6. **Launch:** add P7.3 polish, privacy/support pages, and store metadata. Build the future
   `publish-mobile.yml` only when ready to submit.

**Out of scope for P7.1/P7.2:** PR preview URLs, multi-region, WAF, OTA updates, account
sync, store auto-submission, and a custom backend. These can be added later without
changing the web or artifact layout.

# Iron Altar — Build Plan

Strength training tracker with a heavy metal / Greek mythology theme (Milo of Croton),
rendered as an 8-bit pixel-art RPG. Gamified via a Tamagotchi-style avatar that grows
as you train. Must run on iOS, Android, and web.

- **MVP target:** end of November 2026
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

- **P0 includes** repo setup + lint/format. **No CI** in P0.

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
- **Charts:** `react-native-svg` + `victory-native` (cross-platform, works on web).
- **Animation:** Reanimated 3 + `moti`; sprite frames via `expo-image` or a lightweight
  sprite-sheet component.
- **Styling:** design-token theme + StyleSheet (NativeWind optional, not required).
  Pixel look via custom font (Press Start 2P) and a strict palette.
- **Testing:** Jest + React Native Testing Library. (Maestro e2e later.)
- **Web deploy:** `expo export --platform web` to a static host (Vercel / Netlify / EAS Hosting).

## 2. Architecture

```
src/
  app/                    # screens (Expo Router)
    (tabs)/index          # Dungeon Gym / landing
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
- XP = sum over `SetEntry` where `isWarmup = false` of `weightKg * reps` (bodyweight sets
  with weight 0 contribute 0 volume).

## 4. Feature Breakdown (from spec)

1. **Landing / Dungeon Gym** — themed home, current avatar, streak, XP trend, quick
   "Start Workout", recent stats.
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
- **P2 Profile + Avatar:** character registry, avatar component, sprite-sheet loader,
  stage calc, profile screen.
- **P3 Session Log:** exercise picker, set entry (weight/reps/warmup/notes), rest timer,
  validation, persistence. Duplicate-set button (#1); resume in-progress session (#2);
  retroactive workouts + `Session` entry-date support (#3).
- **P4 History:** list + detail view. Render retroactively-dated sessions (#3).
- **P5 Data Viz:** chart components + per-lift / body-weight screens.
- **P6 Gamification & Animations:** XP/decay/streak logic, set-complete + workout-complete
  animations, avatar growth, trend indicator. Count manual entry dates for streak/decay (#3).
- **P7 Polish & Ship:** responsive web, accessibility, empty states, static web export +
  hosted URL, native build config (EAS). Text-file import (#4, post-MVP candidate).

## 6. Feature Refinements (triaged)

Efficiency rule: fold **structural** items (data model, domain, persistence, architecture)
in as early as possible; defer **experiential** items (polish, feel, copy) until the feature
can actually be used. Each phase pulls in the refinements that intersect its surface area.

| #  | Refinement                                                                                          | Phase                          | Notes                                                                                                                                                                                       |
| -- | --------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1  | Duplicate-set button: re-log a set with the same weight x reps without re-entering.                  | **P3** (Session Log)           | Operates on the existing `SetEntry` shape — no schema/domain change. Small UI win, best built alongside set entry.                                                                          |
| 2  | In-progress session survives leaving the screen, so the user can check prior sessions and return.    | **P1** (persist) + **P3** (UX) | Structural. Phase A (P1): persist the draft session instead of the in-memory `useSessionStore`, so it survives navigation and app restart. Phase B (P3): resume affordance on Dungeon Gym + return to the active session. |
| 3  | Log retroactive workouts for prior dates.                                                            | **P1.1** (data) + **P3** (UX) + **P6** (streak/decay) | Structural. P1.1 shipped the data model: `Session.date` is the performed calendar day, `startedAt`/`endedAt` are optional (live only), and the draft/store carry a settable entry date. P3 adds the date-picker UX and retroactive flow. Feeds History (P4); weekly streak/decay (P6) must count manual date, not just "today". |
| 4  | Import workout data from a text file.                                                                | **P7** (post-MVP candidate)    | Needs a documented import format (CSV/JSON), a bulk-insert repository method with de-dupe, and platform file pickers (web input vs native document picker). Defer until the data model is stable; scope risk vs the Nov MVP. Doubles as a backfill path for #3. |

### Triaged into phases

- **P1 Data (done):** persist the active/draft session (prerequisite for refinement #2).
- **P1.1 Session Entry Date (done):** `Session` supports a user-chosen performed date
  (data model for refinement #3).
- **P3 Session Log:** duplicate-set (#1); resume in-progress session UX (#2); retroactive
  workouts — date-picker UX over the P1.1 entry-date model (#3).
- **P4 History:** render retroactively-dated sessions (#3 dependency).
- **P6 Gamification:** account for manual entry dates in weekly streak/decay (#3).
- **P7 Polish & Ship:** text-file import (#4) — post-MVP candidate; confirm format before
  building.
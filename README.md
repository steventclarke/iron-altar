# Iron Altar

Strength training tracker with a heavy metal / Greek mythology theme (Milo of Croton),
rendered as an 8-bit pixel-art RPG. Train to feed a Tamagotchi-style avatar that grows
as you get stronger. Runs on iOS, Android, and web.

See [`plan.md`](./plan.md) for the full build plan and resolved decisions, and
[`spec.md`](./spec.md) for the original brief.

## Stack

Expo (React Native) + TypeScript, Expo Router, Zustand, AsyncStorage (local-first).

## Commands

```bash
npx expo start          # dev server (i / a / w to open iOS / Android / web)
npx expo start --web    # web
npm run lint            # eslint (expo lint)
npm run typecheck       # tsc --noEmit
npm run format          # prettier --write
npx expo export --platform web   # static web build to dist/
```

## Structure

- `src/app/` — Expo Router screens (only routes live here).
- `src/domain/` — types + pure logic (XP, units, stages).
- `src/data/` — seed data, sync seam (repositories/DB land in P1).
- `src/state/` — Zustand stores.
- `src/ui/` — themed components and primitives.
- `src/art/` — sprite-sheet format and character registry.

## Status

P0 scaffold: themed skeleton routes, domain logic, stores, and web export working.

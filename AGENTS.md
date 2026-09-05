# Agent Instructions (AGENTS.md)

> Read this file first. It describes the **current** architecture: a
> *content-driven* PixiJS game — adding levels/actors/dialogue is JSON +
> assets, not code. Full details: [ADR-004](docs/adrs/004-content-driven-scaling.md)
> and the [content-authoring guide](docs/content-authoring.md).

## Repository Overview

A web-based 2D mystery-investigation game (proof-of-concept) built with
**PixiJS v8 + TypeScript + Vite**. Top-down, sprite-based, free movement
(AABB collision), interactable NPCs with a branching, flag-gated dialogue
engine, one-shot triggers, and data-driven level transitions (exits). Two
playable levels ship today: `level1` (village/farm art) and `level2`
("The Glade" — placeholder art, demonstrates actor reuse + dialogue +
trigger + round-trip exits).

**Refactor status (2026-09): COMPLETE.** Phases 0–8 of the content-driven
plan (see `docs/plans/2026-09-05_052213-mystery-game-content-driven-scaling.md`)
are on `main`: green build, test infra, v2 schema only (no v1 leftovers),
ContentIndex + validator, scene framework, LevelScene, dialogue UI
extraction, pure action/zone logic, level2 config-only proof, docs.
Follow-up ideas live in the plan's "Future Considerations".

## Technology Stack

- **PixiJS v8** — 2D WebGL rendering
- **TypeScript** (strict) + **Vite** 6 — build/dev server (port 8080)
- **ESLint + Prettier** — enforced by `npm run build`
- **vitest** — unit tests for pure logic (node env, no DOM)

## Commands (run from `game/`)

```bash
npm ci                # install (first time)
npm run dev           # dev server → http://localhost:8080
npm test              # vitest run (76 tests today)
npx tsc --noEmit      # type check
npm run build         # gate: eslint + tsc + vite build (MUST pass before commit)
npm run validate:content   # content cross-reference validator (0 ERROR / 0 WARN)
```

**The commit gate is `npm test` + `npm run build` + `npm run validate:content`
(0 ERRORs).** This repo pushes straight to `main` (no PR flow today). Commit
with the repo's configured identity (MoMo <momo@thani.sh>), one logical change
per commit, conventional prefixes.

## Code Structure

```
game/
├── public/assets/            # GENERATED binaries + Pixi sheet manifests — do NOT hand-edit;
│   ├── actors/<actorId>/     #   source art lives in repo-root assets/, processed via
│   │   └── frames/{idle,walk}.png+.json    # tools/asset-designer (256px cells, down/up/left/right)
│   └── levels/<levelId>.webp
└── src/
    ├── main.ts               # slim boot: Application + InputSystem + SceneManager + shared GameState
    ├── engine/               # framework glue (knows Pixi)
    │   ├── types.ts          # Scene interface (Container + init/update/resize)
    │   ├── SceneRegistry.ts  # id → SceneFactory map (pure, tested)
    │   ├── SceneManager.ts   # ticker pump + resize; goto(id, params) swaps scenes
    │   └── utils/Input.ts    # keyboard singleton
    ├── app/                  # presentation layer
    │   ├── screens/LevelScene.ts   # level: bg, actors, movement, camera, dialogue wiring,
    │   │                          # zone/trigger/exit evaluation + action hooks
    │   └── ui/DialogueBox.ts       # dumb presentational dialogue panel (speaker/body/choices/portrait)
    └── game/                 # pure game layer — content + logic, no Pixi where avoidable
        ├── state/GameState.ts      # flags + position (shared across scenes)
        ├── systems/
        │   ├── ActionRunner.ts     # Action[] + WorldHooks → effects (pure, tested)
        │   ├── visibleChoices.ts   # flag-gated dialogue choices (pure, tested)
        │   ├── zones.ts            # pointInZone/overlappingTriggers/exitAt +
        │   │                       #   evaluateZoneEvents (enter-edge frame decision, pure, tested)
        │   ├── AssetLoader.ts      # preloadLevel(level): assets derived from level config
        │   └── assetUrls.ts        # collectLevelAssetUrls (pure, tested)
        └── data/
            ├── types.ts            # ALL content types (v2 schema)
            ├── content.ts          # ContentIndex: globs characters/* + levels/* + game.json
            ├── assetPaths.ts       # URL-convention helpers (pure, tested)
            ├── game.json           # boot: startScene, startLevel, defaultPlayerActorId
            ├── characters/<id>.json  # ActorConfig { id, displayName, scale? }
            └── levels/<id>.json      # LevelConfig (see schema below)
```

## Architecture Rules

1. **Three layers**: `engine/` (Pixi integration) · `app/` (screens/UI) ·
   `game/` (pure data + logic). Game logic must stay render-agnostic so vitest
   can run it in node.
2. **Scenes**: everything full-screen is a `Scene` (extends `Container`,
   implements `init/update/resize`). Register factories on the `SceneManager`;
   switch with `goto(id, params)`. Screens never construct each other.
3. **Content is data**: all content JSON lives in `src/game/data/`.
   `content.ts` globs it at build time into id-keyed maps (`characters`,
   `levels`) + `lookupLevel`/`lookupCharacter`. **Never** write inline
   `import.meta.glob` in screens — use `content.ts`.
4. **Asset URLs by convention**: `assetPaths.ts` derives frame-sheet/portrait/
   background URLs; `AssetLoader.preloadLevel()` loads everything a level
   references from the level config. Never hardcode an actor path in a scene.
5. **Schema + validation travel together**: content types live in
   `data/types.ts`; when you add a field/ref kind, extend
   `scripts/validate-content.mjs` in the same change. Validator must end
   **0 ERROR / 0 WARN**.
6. **Pure logic pattern**: rules that can run without Pixi go in
   `game/systems` or `game/state` as pure functions/classes + vitest tests
   (red→green). LevelScene stays a thin consumer.
7. **New behaviors are code**: a new Action type or zone behavior means
   extending the `Action` union + `ActionRunner` (or the zone evaluator) with
   tests — content JSON alone can't invent new mechanics.

## Content Schema (v2)

`LevelConfig`: `id`, `title?`, `background` (`/assets/levels/<id>.webp`),
`imageResolution {width,height}`, `scalingFactor?`,
`player { actorId, start }`,
`actors[] { id, actorId, position, facing?, interactable?, dialogueStart?,
scriptIdOnTalk? }`, `dialogues?`, `scripts?`, `triggers?`, `exits?`,
`collisions[] {x,y,w,h}` — all rects/positions in unscaled map pixels,
half-open containment.

`ActorConfig` (characters/*.json): `id`, `displayName`, `scale?` (multiplier
of the 64px tile; ~4 for the current cast).

`Action` union: `move_character` (legacy alias, mapped to moveActor) ·
`move_actor` · `set_flag` · `clear_flag` · `load_level` · `message`.

Dialogue node: `{ speaker: actorId, text, choices[] }`; choice:
`{ text, next?, action?, scriptId?, requiresFlag?, blocksFlag? }`. No `next`
ends the dialogue. Triggers/exits fire on zone **entry** only; `once: true`
triggers are consumed by a `trigger:<level>:<id>` flag that survives scene
switches. See `docs/content-authoring.md` for the full recipes.

## Adding Content (recipes — no code)

- **New actor**: art → `assets/actors/<id>/` (regenerate processed sheets) →
  `characters/<id>.json` (`id`, `displayName`, `scale`) → reference from a
  level's `actors[]` or `player.actorId`.
- **New level**: bg art → `public/assets/levels/<id>.webp` → copy a level JSON
  as template → point an exit at it / set `game.json` `startLevel`.
- **New dialogue / trigger / exit**: pure JSON inside the level file (keys
  wired per the schema). Flag-gated discovery pattern: trigger zone →
  `set_flag` script → `requiresFlag` choice.
- Details + templates: **`docs/content-authoring.md`**.

## Testing Conventions

- Pure modules get vitest files beside them (`*.test.ts`), written **first**.
- Don't unit-test Pixi rendering; test `game/` layer logic and `engine/`
  bookkeeping with fakes.
- `npm test` currently: 76 tests (GameState, types, assetPaths, assetUrls,
  ActionRunner, visibleChoices, zones incl. evaluateZoneEvents,
  SceneRegistry, SceneManager).

## Known Issues / Notes

- `level2.webp` is generated placeholder art — real art pending.
- `goon.json` has `scale: 6` (384px sprite) — likely an art/scale bug;
  flagged, not silently changed.
- `public/assets/levels/level1.webp` is farm-scene art that predates the
  "village mystery" direction in ADR-003.
- Dev server needs `server.allowedHosts: true` in `vite.config.ts` when
  exposed through trycloudflare-style tunnels (Vite 6 Host check).
- Dialogue/trigger E2E was validated via unit tests on the pure decision
  layer plus live runs; portrait rendering (`speech/talking.png`,
  `DialogueBox.setPortrait`) is wired but unused by current content.

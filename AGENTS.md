# Agent Instructions (AGENTS.md)

> Read this file first. It describes the **current** architecture (mid-refactor toward a content-driven game) and the rules every agent must follow.

## Repository Overview

A web-based 2D mystery-investigation game (proof-of-concept) built with **PixiJS v8 + TypeScript + Vite**. The game is top-down, sprite-based, and currently has one explorable level rendered over a painted background image, with free movement (AABB collision), interactable NPCs, and a branching dialogue engine.

**Refactor status (2026-09):** the codebase is being migrated to a *content-driven* architecture — new levels/actors/dialogue should require JSON + assets only, not code. **Phases 0–4b are done and on `main`** (green build, test infra, schema-v2 types, ContentIndex + validator, scene framework, LevelScene on v2 data). Phases 5–8 remain: see [the plan](docs/plans/2026-09-05_052213-mystery-game-content-driven-scaling.md) for details. There are intentional transitional leftovers (dual v1+v2 keys in level JSON, v1 types still exported) — do not "clean up" without reading the plan's remaining phases.

## Technology Stack

- **PixiJS v8** — 2D WebGL rendering
- **TypeScript** (strict) + **Vite** 6 — build/dev server (port 8080)
- **ESLint + Prettier** — enforced by `npm run build` (no unformatted code lands)
- **vitest** — unit tests for pure logic (node env, no DOM)

## Commands (run from `game/`)

```bash
npm ci                # install (first time)
npm run dev           # dev server → http://localhost:8080
npm test              # vitest run (all *.test.ts under src/)
npx tsc --noEmit      # type check
npm run build         # gate: eslint + tsc + vite build (MUST pass before commit)
npm run validate:content   # content cross-reference validator (report-only today)
```

**The commit gate is `npm test` + `npm run build` + `npm run validate:content` (0 ERRORs).** This repo pushes straight to `main` (no PR flow today). Commit with the repo's configured identity (`git config user.name/user.email` — currently MoMo <momo@thani.sh>), one logical change per commit, conventional prefixes (`feat:`, `fix:`, `refactor:`, `docs:`, `chore:`).

## Code Structure (current)

```
game/
├── index.html / vite.config.ts / package.json
├── public/assets/            # GENERATED binaries + Pixi sheet manifests — do NOT hand-edit;
│   ├── actors/<actorId>/     #   regenerate via repo-root assets/ + tooling (assets/actors source)
│   │   ├── frames/{idle,walk}.png + .json   # sheets w/ animations: down|up|left|right
│   │   ├── speech/talking.png               # dialogue portrait (unused so far)
│   │   └── concept.png
│   └── levels/<levelId>.webp # level background art
└── src/
    ├── main.ts               # slim boot: Application + InputSystem + SceneManager → goto(startScene)
    ├── engine/               # framework glue (knows Pixi)
    │   ├── types.ts          # Scene interface (Container + init/update/resize)
    │   ├── SceneRegistry.ts  # id → SceneFactory map (pure, tested)
    │   ├── SceneManager.ts   # owns ticker pump + resize; goto(id, params) swaps scenes
    │   └── utils/Input.ts    # keyboard singleton (wasd/arrows, e/enter/space, 1-9)
    ├── app/                  # presentation layer
    │   └── screens/LevelScene.ts   # the level: bg sprite, actor sprites, movement+collision,
    │                              # camera, dialogue box UI + input, action execution
    │                              # (dialogue UI is still inline here — Phase 5 extracts it)
    └── game/                 # pure game layer — content + logic, no Pixi where avoidable
        ├── state/GameState.ts        # flags + current levelId/position (pure, tested)
        ├── systems/
        │   ├── AssetLoader.ts        # preloadLevel(level): loads every asset a level needs
        │   └── assetUrls.ts          # collectLevelAssetUrls(level) — pure, tested
        └── data/
            ├── types.ts              # ALL content types (v1 + v2 — additive)
            ├── content.ts            # ContentIndex: globs characters/* + levels/* + game.json
            ├── assetPaths.ts         # URL-convention helpers (pure, tested)
            ├── game.json             # boot: startScene, startLevel, defaultPlayerActorId
            ├── characters/<id>.json  # ActorConfig-ish (id, name, displayName, sprite, scale)
            └── levels/<id>.json      # LevelConfig (see schema below)
```

## Architecture Rules

1. **Three layers**: `engine/` (Pixi integration) · `app/` (screens/UI) · `game/` (pure data + logic). Game logic must stay render-agnostic so vitest can run it in node.
2. **Scenes**: everything full-screen is a `Scene` (extends `Container`, implements `init/update/resize`). Register factories on the `SceneManager`; switch with `goto(id, params)`. Screens never construct each other.
3. **Content is data**: all content JSON lives in `src/game/data/`. `content.ts` globs it at build time and exports id-keyed maps (`characters`, `levels`) + `lookupLevel`/`lookupCharacter`. **Never** write inline `import.meta.glob` in screens — use `content.ts`.
4. **Asset URLs by convention, not literals**: `assetPaths.ts` derives `/assets/actors/<id>/frames/<state>.json`, portraits, level backgrounds. `AssetLoader.preloadLevel()` loads everything a level references (bg + every actor's idle/walk sheets), derived from the level config — never hardcode a character path in a scene.
5. **Schema**: content types are in `data/types.ts` — extend them (additively) rather than forking. Level/actor/dialogue field shapes: see "Content Schema" below.
6. **Validation**: `scripts/validate-content.mjs` (zero-dep Node) cross-checks ids, refs, rect bounds, and asset existence against `public/assets`. Keep it at **0 ERROR / 0 WARN** for content changes. When you add a v2 field/ref kind, extend this script too.

## Content Schema (v2 — what LevelScene consumes)

`LevelConfig`: `id`, `title?`, `background` (`/assets/levels/<id>.webp`), `imageResolution {width,height}`, `scalingFactor?`, `player { actorId, start }`, `actors[] { id, actorId, position, facing?, interactable?, dialogueStart?, scriptIdOnTalk? }`, `dialogues?`, `scripts?`, `triggers?`, `exits?`, `collisions[] {x,y,w,h}` (map-space pixels).

`ActorConfig` (characters/*.json): `id`, `displayName`, `scale?` (currently also carries legacy `name`/`sprite`).

`Action` union (extend for new behaviors): `move_character` (legacy) · `move_actor` · `set_flag` · `clear_flag` · `load_level` · `message`.

**Transitional state:** `levels/level1.json` still carries BOTH v1 keys (`characters[]`, `playerStart`) and v2 keys (`player`, `actors[]`) — the v1 copies exist only until the last v1 consumer is gone. `content.ts` still types levels as v1 `LevelData` (LevelScene casts at the boundary). Cleanup is scheduled in the plan's later phases — leave it.

## Adding Content (recipes)

**New actor** (no code):
1. Art: add `assets/actors/<id>/{frames,idle|walk}.png`, `speech/talking.png` etc. → regenerate sheets into `public/assets/actors/<id>/` with the asset-designer tooling (`tools/asset-designer`, see its README).
2. `src/game/data/characters/<id>.json` — `{ "id", "name", "displayName", "sprite", "scale" }` (mirror `daisy.json`).
3. Reference it from a level's `actors[]` (or `player.actorId`).
4. `npm run validate:content` → 0 ERRORs.

**New level** (mostly data):
1. Background art → `public/assets/levels/<id>.webp`; note its pixel size → `imageResolution`.
2. `src/game/data/levels/<id>.json` — start from `level1.json` as a template (keep `id`, `imageResolution`, `player`, `actors`, `collisions`; drop the v1 legacy keys in NEW files).
3. Boot into it via `game.json` `startLevel`, or add an `exits[]` entry from another level (Phase 6 completes exit handling).
4. `npm run validate:content` → 0 ERRORs.

**New dialogue / script / action**: dialogue trees and scripts are plain objects inside the level file (`dialogues`, `scripts`) referenced by key from `actors[].dialogueStart`, `triggers[].scriptId`, or `DialogueChoice.scriptId`. New action *types* require extending the `Action` union + the executor in `LevelScene` (Phase 5 moves this into a pure `ActionRunner` — prefer that once it exists).

## Testing Conventions

- Pure modules get vitest files beside them (`*.test.ts`), written **first** (red → green).
- Don't unit-test Pixi rendering; test `game/` layer logic and `engine/` bookkeeping with fakes.
- `npm test` currently: 31 tests across GameState, content types, assetPaths, assetUrls, SceneRegistry, SceneManager.

## Known Issues / Notes

- No level currently defines `dialogues` — the dialogue UI path is code-complete but untested in-game.
- `goon.json` has `scale: 6` (384px sprite) — looks like an art/scale bug; flagged, not silently changed.
- `public/assets/levels/level1.webp` is farm-scene art that predates the "village mystery" direction in ADR-003.
- Dev server needs `server.allowedHosts: true` in `vite.config.ts` when exposed through trycloudflare-style tunnels (Vite 6 Host check).

# ADR-004: Content-Driven Scaling — Registries, Scenes, and Data-Driven Transitions

Date: 2026-09-05

## Status

Accepted

## Context

The game's content (levels, actors, dialogue) was hardcoded in `GameScreen`
(a single 500+ line screen) with player identity and asset loading baked in.
Adding a level meant editing code; NPCs were silently skipped when their
assets weren't load-listed; there was no way to move between levels, gate
content on player state, or author dialogue as data.

The goal: **adding levels/actors/dialogue should be JSON + assets only** —
the engine stays fixed and content is additive.

## Decision

Adopt the v2 content schema and a small set of framework pieces (all in place
as of 2026-09):

1. **Content is data.** All content lives in `game/src/game/data/` as typed
   JSON: `characters/*.json` (`ActorConfig`), `levels/*.json` (`LevelConfig`),
   and `game.json` (boot config). `data/content.ts` globs these at build time
   into id-keyed registries (`characters`, `levels`, `lookupLevel`, ...).
2. **Scenes, not a single screen.** `engine/SceneManager` swaps typed
   `Scene`s (`engine/types.ts`) by id; `main.ts` registers factories and boots
   from `game.json`. `app/screens/LevelScene` is the (data-driven) level scene;
   future screens (title, menus, cutscenes) register the same way.
3. **Levels are self-describing.** A `LevelConfig` declares its background,
   player, actor placements, dialogue trees, scripts, triggers, exits, and
   collisions. Nothing about a level is derived from code.
4. **Pure logic layer.** Gameplay rules that can run without Pixi live in
   `game/systems/` and `game/state/` and are unit-tested in node:
   `GameState` (flags + position), `ActionRunner` (Action union → WorldHooks),
   `visibleChoices` (flag-gated dialogue options), `zones`
   (`evaluateZoneEvents`: enter-edge trigger/exit firing), `assetPaths` /
   `assetUrls` (path conventions → what a level must load).
5. **Content is validated, not trusted.** `scripts/validate-content.mjs`
   (zero-dependency node, run as `npm run validate:content`) cross-checks ids,
   actor/dialogue/script/exit references, rect bounds, and asset existence
   under `public/assets`. A content change is not done until it reports
   0 errors / 0 warnings.
6. **Asset loading is derived.** `AssetLoader.preloadLevel(level)` loads the
   background plus every actor sheet the level references (from the level's
   own data) — no hardcoded load lists in scenes. Pixel-art sprites render
   with NEAREST sampling.

## Consequences

### Positive
- Adding `levels/level2.json` + one `characters/*.json` + a placeholder
  background shipped a fully playable second level (dialogue, a flag-gated
  branch, a one-shot trigger, round-trip exits) with **zero game-code
  changes** (Phase 7 proof).
- NPCs spawn correctly: a level's actors are loaded from the level data, so
  no actor can be silently forgotten (the old daisy bug).
- Game logic is testable without a browser: 76 vitest tests cover the pure
  layer (state, actions, zone decisions, choice gating, path conventions).

### Negative
- Content must match the schema exactly or the validator (and type system)
  reject it — content authors need the recipes in
  `docs/content-authoring.md` / `AGENTS.md`.
- Schema evolution requires touching `types.ts` + the validator together.

### Neutral
- v1 transitional types/keys (`CharacterData`, `LevelData`, dual-key level
  JSON) were removed in Phase 8 — a single schema remains.
- Dialogue trees are still authored per level file; shared global dialogue
  hubs can be extracted later without schema break (a `dialogueRef` field).

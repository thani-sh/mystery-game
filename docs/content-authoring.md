# Content Authoring Guide

Adding game content = **JSON + assets**. No code changes required for any of
the recipes below. After every content change run the gate:

```bash
cd game
npm run validate:content   # must end: 0 [ERROR] 0 [WARN]
npm run build              # must pass (lint + tsc + vite)
```

## Anatomy of the content

| Path | Kind | Required fields |
|---|---|---|
| `src/game/data/characters/<id>.json` | Actor | `id`, `displayName`, optional `scale` (multiplier of 64px; ~4 for most actors) |
| `src/game/data/levels/<id>.json` | Level | see below |
| `src/game/data/game.json` | Boot | `startScene`, `startLevel`, `defaultPlayerActorId` |

Assets live under `public/assets/`: `actors/<id>/frames/{idle,walk}.png` +
matching sheet JSONs (256px cells, 4×4 grid, animations `down/up/left/right`,
transparent background), `actors/<id>/speech/talking.png` (portrait, optional),
`levels/<levelId>.webp` (background art). Source art mirrors into the
repo-root `assets/` tree; regenerate processed sheets with the
`tools/asset-designer` pipeline.

## Level schema (`levels/<id>.json`)

```jsonc
{
  "id": "level2",                        // unique; referenced by exits
  "title": "The Glade",
  "background": "/assets/levels/level2.webp",  // must exist in public/assets
  "imageResolution": { "width": 2000, "height": 1500 },  // art pixel size
  "scalingFactor": 1,
  "player": { "actorId": "bets", "start": { "x": 500, "y": 750 } },
  "actors": [
    { "id": "ern", "actorId": "ern", "position": { "x": 1200, "y": 900 },
      "interactable": true, "dialogueStart": "ern_intro" }
  ],
  "collisions": [ { "x": 0, "y": 0, "w": 2000, "h": 20 } ],  // map-pixel rects
  "dialogues": { /* node id -> { speaker, text, choices? } */ },
  "scripts":  { /* script id -> Action[] */ },
  "triggers": [ { "id": "t1", "zone": { "x": 100, "y": 100, "w": 50, "h": 50 },
                  "once": true, "scriptId": "found_thing" } ],
  "exits":    [ { "id": "to_village", "zone": { "x": 700, "y": 1420, "w": 600, "h": 60 },
                  "targetLevel": "level1", "spawn": { "x": 2134, "y": 1391 } } ]
}
```

All coordinates/rects are in **unscaled background pixels** (same space as the
collision rects). Zone containment is half-open: `[x, x+w) × [y, y+h)`.

### Dialogue

A node is `{ "speaker": <actorId>, "text": "...", "choices": [...] }`.
A choice is `{ "text": "...", "next": <nodeId>?, "scriptId": <scriptId>?,
"requiresFlag": <flag>?, "blocksFlag": <flag>? }`.

- No `next` → choosing that entry ends the dialogue.
- `requiresFlag` hides the choice until the flag is set; `blocksFlag` hides it
  once the flag is set (already-offered options).
- `action`/`scriptId` run effects when chosen (see Actions).

### Actions (scripts + choice effects)

```jsonc
{ "type": "set_flag", "flag": "promised_daisy" }
{ "type": "clear_flag", "flag": "..." }
{ "type": "move_actor", "actorId": "daisy", "target": { "x": 100, "y": 100 } }
{ "type": "load_level", "levelId": "level2", "spawn": { "x": 500, "y": 750 } }
{ "type": "message", "text": "..." }   // console-only for now
```

### Triggers & exits

- **Trigger**: fires its `scriptId` when the player *walks into* its zone
  (enter-edge — standing inside does not re-fire). `once: true` consumes it
  via a `trigger:<level>:<triggerId>` flag that survives level changes.
  `once: false` re-fires on every re-entry.
- **Exit**: when the player enters its zone the scene switches to
  `targetLevel`, placing the player at `spawn`. Exits round-trip: level1's
  exit targets level2 and vice-versa.

## Recipes

**New actor:** art into `assets/actors/<id>/` → regenerate processed sheets →
`characters/<id>.json` (`id`, `displayName`, `scale`) → reference it in a
level's `actors[]` or `player.actorId`.

**New level:** background art → `public/assets/levels/<id>.webp` (note its
pixel size for `imageResolution`) → copy an existing level JSON, retarget id /
background / player / actors / collisions → point an exit at it (and/or set
`game.json` `startLevel` to boot into it).

**New dialogue/branch:** add nodes under `dialogues`, point an actor's
`dialogueStart` at the root, gate options with `requiresFlag`/`blocksFlag`
whose flags come from triggers or earlier choices.

**Flag-gated discovery (pattern used in level2):**
1. trigger zone near the secret spot → script `{ set_flag: "found_shrine" }`
2. dialogue choice `"requiresFlag": "found_shrine"` on a later conversation

## Golden rules

1. Validator must end **0 ERROR / 0 WARN** — it checks ids, refs, rect bounds,
   and that every asset path exists under `public/assets`.
2. New content folders/kinds require updating `types.ts` **and**
   `scripts/validate-content.mjs` together.
3. Don't hand-edit `public/assets` binaries — regenerate from source art.
4. If you need a NEW action type or zone behavior, that is code — follow the
   Action union + `ActionRunner` pattern and add tests.

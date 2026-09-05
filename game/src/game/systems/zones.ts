// Pure zone/trigger/exit overlap logic for level transitions. A "zone" is an
// axis-aligned rectangle in unscaled map-pixel space (same space as level
// collisions); containment is half-open — [x, x+w) × [y, y+h) — so adjacent
// zones never double-claim a point on their shared boundary.
//
// Firing semantics live with the caller (LevelScene): these helpers only
// answer *what is currently active at a position*, leaving enter/exit edge
// detection and script execution to the scene's frame loop. No pixi/DOM
// imports, so everything here is unit-testable in node.
import type {
  LevelConfig,
  LevelExit,
  Position,
  Rectangle,
  Trigger,
} from "../data/types";

/**
 * GameState flag that consumes a once-only trigger. Namespaced per level so
 * the same trigger id can safely exist in different levels, and so the flag
 * survives scene reloads (a consumed trigger never re-fires after the player
 * leaves the level and comes back).
 */
export function flagNameFor(levelId: string, triggerId: string): string {
  return `trigger:${levelId}:${triggerId}`;
}

/**
 * Half-open containment test: true while `p` is inside `z`'s bounds including
 * the min edges but excluding the max edges.
 */
export function pointInZone(p: Position, z: Rectangle): boolean {
  return p.x >= z.x && p.x < z.x + z.w && p.y >= z.y && p.y < z.y + z.h;
}

/**
 * The triggers of `level` whose zone contains `pos` and are not yet consumed:
 * a trigger with `once: false` is always active (it re-fires on every
 * re-entry), while a trigger with `once` (the default, undefined counts as
 * once) is consumed once its `flagNameFor(level.id, id)` flag is set.
 */
export function overlappingTriggers(
  level: Pick<LevelConfig, "id" | "triggers">,
  pos: Position,
  hasFlag: (flag: string) => boolean,
): Trigger[] {
  const triggers = level.triggers ?? [];
  return triggers.filter((trigger) => {
    if (!pointInZone(pos, trigger.zone)) return false;
    if (trigger.once === false) return true;
    return !hasFlag(flagNameFor(level.id, trigger.id));
  });
}

/**
 * The first exit whose zone contains `pos`, or undefined. Exits carry no
 * once/consumed state — every overlap is a candidate transition, and the
 * first matching exit in content order wins.
 */
export function exitAt(
  level: Pick<LevelConfig, "exits">,
  pos: Position,
): LevelExit | undefined {
  const exits = level.exits ?? [];
  return exits.find((exit) => pointInZone(pos, exit.zone));
}

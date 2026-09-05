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
  Action,
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

// --- Frame-level decision ---------------------------------------------------
// One pure call answers "what should happen this frame at `pos`" given the
// previous frame's overlap set. LevelScene feeds its prevOverlapZones in and
// swaps in the returned nextKeys — no inline edge-detection bookkeeping.

/** A trigger the player just entered this frame (was not overlapped before). */
export interface ZoneTriggerEvent {
  key: string; // consumption flag name (flagNameFor)
  script: Action[]; // resolved actions for the trigger's scriptId (may be [])
  once: boolean; // false => repeatable on every re-entry
}

export interface ZoneFrame {
  /** Triggers entered THIS frame (script should run now). */
  events: ZoneTriggerEvent[];
  /** Exit entered this frame, if any (scene should transition). */
  exit: LevelExit | null;
  /** The overlap set to carry into the next frame. */
  nextKeys: Set<string>;
}

export function evaluateZoneEvents(
  level: Pick<LevelConfig, "id" | "triggers" | "exits" | "scripts">,
  pos: Position,
  hasFlag: (flag: string) => boolean,
  prevKeys: ReadonlySet<string>,
): ZoneFrame {
  const active = overlappingTriggers(level, pos, hasFlag);
  const exit = exitAt(level, pos) ?? null;

  const nextKeys = new Set<string>();
  for (const trigger of active) {
    nextKeys.add(flagNameFor(level.id, trigger.id));
  }
  if (exit) {
    nextKeys.add(`exit:${level.id}:${exit.id}`);
  }

  const events: ZoneTriggerEvent[] = [];
  for (const trigger of active) {
    const key = flagNameFor(level.id, trigger.id);
    if (prevKeys.has(key)) continue; // already inside — not an entry
    events.push({
      key,
      script: level.scripts?.[trigger.scriptId] ?? [],
      once: trigger.once !== false,
    });
  }

  return { events, exit, nextKeys };
}

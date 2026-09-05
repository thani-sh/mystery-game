// Pure executor for content-driven action scripts. An `Action[]` is dispatched
// one-by-one against a minimal `WorldHooks` interface so this module stays free
// of Pixi/DOM/scene knowledge — unit-testable in node and implementable by any
// scene or game system (LevelScene provides the world hooks today).
//
// Robustness policy: content is data, so a malformed or unknown action shape
// must never crash the level. Unexpected entries are logged with a console.warn
// and skipped; only well-formed actions reach their hook.
import type { Action, Position } from "../data/types";

/** The world-facing effects an action script can trigger. */
export interface WorldHooks {
  /** Reposition an actor (instance id) in the current level. */
  moveActor(actorId: string, target: Position): void;
  /** Record that a flag is set (persists across level transitions). */
  setFlag(flag: string): void;
  /** Remove a flag. */
  clearFlag(flag: string): void;
  /** Navigate to another level, optionally at a spawn point. */
  loadLevel(levelId: string, spawn?: Position): void;
  /** Surface a message to the player (dialog box / toaster / log). */
  message(text: string): void;
}

/**
 * Execute every action in `actions`, in order, against `hooks`.
 *
 * The legacy v1 `move_character` variant routes through `moveActor` exactly
 * like `move_actor` (its `characterId` is the actor id it moves).
 */
export function runActions(actions: Action[], hooks: WorldHooks): void {
  for (const action of actions) {
    switch (action.type) {
      case "move_actor":
        hooks.moveActor(action.actorId, action.target);
        break;
      case "move_character":
        // Legacy v1 spelling of move_actor — same effect.
        hooks.moveActor(action.characterId, action.target);
        break;
      case "set_flag":
        hooks.setFlag(action.flag);
        break;
      case "clear_flag":
        hooks.clearFlag(action.flag);
        break;
      case "load_level":
        hooks.loadLevel(action.levelId, action.spawn);
        break;
      case "message":
        hooks.message(action.text);
        break;
      default:
        // Unknown / forward-incompatible action type: warn and skip.
        console.warn("[ActionRunner] skipping unknown action", action);
    }
  }
}

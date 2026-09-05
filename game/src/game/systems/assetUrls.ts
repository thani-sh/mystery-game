// Pure asset-URL collector: derives every asset a level needs at runtime from
// its LevelConfig — the background image plus the idle/walk frame sheets of
// the player actor and every placed actor. No pixi/DOM imports, so it is
// trivially unit-testable in a node environment.
//
// Portraits are intentionally excluded for now: the current screen never
// shows them (add back here when a portrait UI lands).
import { resolveActorFrameSheet } from "../data/assetPaths";
import type { LevelConfig } from "../data/types";

/**
 * Unique, deterministic asset URLs required to run `level`.
 *
 * The background is always included; each distinct actorId (player first, then
 * every `level.actors[].actorId`) contributes its idle + walk sheet URLs.
 * Duplicates (e.g. the player also placed as an actor) are collapsed and the
 * result is sorted, so the output is stable regardless of content order.
 */
export function collectLevelAssetUrls(level: LevelConfig): string[] {
  const urls = new Set<string>();
  urls.add(level.background);

  const actorIds = new Set<string>([level.player.actorId]);
  for (const actor of level.actors) {
    actorIds.add(actor.actorId);
  }
  for (const actorId of actorIds) {
    urls.add(resolveActorFrameSheet(actorId, "idle"));
    urls.add(resolveActorFrameSheet(actorId, "walk"));
  }

  return [...urls].sort();
}

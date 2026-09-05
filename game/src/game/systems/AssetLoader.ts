// Asset loading derived from content: given a LevelConfig, preloadLevel
// computes the full URL set (background + every actor's idle/walk sheets) and
// loads it through Pixi's Assets in one parallel batch. Levels never hardcode
// asset paths anymore — the URL list is the pure `collectLevelAssetUrls`.
//
// Failure policy: a single missing asset must never prevent the level from
// booting, so load errors are caught, logged and swallowed (the same
// tolerance the old GameScreen had when it skipped actors with missing
// frames). Consumers then read successfully-cached assets via Assets.cache.
import { Assets } from "pixi.js";
import type { LevelConfig } from "../data/types";
import { collectLevelAssetUrls } from "./assetUrls";

/**
 * Load every asset `level` needs (background + actor frame sheets) and
 * resolve once they are in the Pixi cache. Never rejects: load failures are
 * reported with a console.warn and execution continues.
 */
export async function preloadLevel(level: LevelConfig): Promise<void> {
  const urls = collectLevelAssetUrls(level);
  try {
    await Assets.load(urls);
  } catch (error) {
    console.warn(
      `[AssetLoader] failed to preload assets for level "${level.id}"`,
      urls,
      error,
    );
  }
}

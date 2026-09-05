import { describe, expect, it } from "vitest";
import type { LevelActor, LevelConfig } from "../data/types";
import { collectLevelAssetUrls } from "./assetUrls";

function makeLevel(overrides: Partial<LevelConfig> = {}): LevelConfig {
  return {
    id: "level1",
    background: "/assets/levels/level1.webp",
    imageResolution: { width: 6336, height: 2688 },
    player: { actorId: "bets", start: { x: 2134, y: 1391 } },
    actors: [],
    ...overrides,
  };
}

function makeActor(
  id: string,
  actorId: string,
  overrides: Partial<LevelActor> = {},
): LevelActor {
  return { id, actorId, position: { x: 1, y: 1 }, ...overrides };
}

describe("game/systems/assetUrls — collectLevelAssetUrls", () => {
  it("includes the background plus the player's idle/walk sheets even with no actors", () => {
    const urls = collectLevelAssetUrls(makeLevel());

    expect(urls).toEqual([
      "/assets/actors/bets/frames/idle.json",
      "/assets/actors/bets/frames/walk.json",
      "/assets/levels/level1.webp",
    ]);
  });

  it("dedupes when the player is also listed among the actors", () => {
    const level = makeLevel({
      actors: [makeActor("bets", "bets", { position: { x: 2134, y: 1391 } })],
    });

    const urls = collectLevelAssetUrls(level);

    // Player sheets counted once — no duplicates despite two references.
    expect(urls).toEqual([
      "/assets/actors/bets/frames/idle.json",
      "/assets/actors/bets/frames/walk.json",
      "/assets/levels/level1.webp",
    ]);
    expect(new Set(urls).size).toBe(urls.length);
  });

  it("collects every distinct actor's sheets alongside the player's", () => {
    const level = makeLevel({
      actors: [
        makeActor("daisy", "daisy"),
        makeActor("goon", "goon"),
        makeActor("daisy-copy", "daisy"), // second instance of the same actor
      ],
    });

    expect(collectLevelAssetUrls(level)).toEqual([
      "/assets/actors/bets/frames/idle.json",
      "/assets/actors/bets/frames/walk.json",
      "/assets/actors/daisy/frames/idle.json",
      "/assets/actors/daisy/frames/walk.json",
      "/assets/actors/goon/frames/idle.json",
      "/assets/actors/goon/frames/walk.json",
      "/assets/levels/level1.webp",
    ]);
  });

  it("is deterministic: repeated calls return an identical, sorted list", () => {
    const level = makeLevel({
      actors: [
        makeActor("goon", "goon"),
        makeActor("daisy", "daisy"),
        makeActor("bets", "bets"),
      ],
    });

    const first = collectLevelAssetUrls(level);
    const second = collectLevelAssetUrls(level);

    expect(first).toEqual(second);
    expect(first).toEqual([...first].sort());
  });
});

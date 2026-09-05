import { describe, expect, it } from "vitest";
import {
  resolveActorFrameSheet,
  resolveActorPortrait,
  resolveLevelBackground,
} from "./assetPaths";

describe("game/data/assetPaths — public/assets path convention", () => {
  it("resolveActorFrameSheet returns the frames sheet manifest path", () => {
    expect(resolveActorFrameSheet("bets", "idle")).toBe(
      "/assets/actors/bets/frames/idle.json",
    );
    expect(resolveActorFrameSheet("bets", "walk")).toBe(
      "/assets/actors/bets/frames/walk.json",
    );
  });

  it("resolveActorPortrait returns the speech portrait path", () => {
    expect(resolveActorPortrait("daisy")).toBe(
      "/assets/actors/daisy/speech/talking.png",
    );
  });

  it("resolveLevelBackground returns the level background path", () => {
    expect(resolveLevelBackground("level1")).toBe("/assets/levels/level1.webp");
  });

  it("never emits leading double slashes", () => {
    expect(resolveActorFrameSheet("bets", "idle").startsWith("//")).toBe(false);
    expect(resolveActorPortrait("bets").startsWith("//")).toBe(false);
    expect(resolveLevelBackground("level1").startsWith("//")).toBe(false);

    // Each resolves from the single public-assets root.
    expect(resolveActorFrameSheet("bets", "walk")).toMatch(/^\/assets\//);
    expect(resolveActorPortrait("bets")).toMatch(/^\/assets\//);
    expect(resolveLevelBackground("level1")).toMatch(/^\/assets\//);
  });
});

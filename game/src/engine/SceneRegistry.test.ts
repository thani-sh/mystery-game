import { describe, expect, it, vi } from "vitest";
import { SceneRegistry } from "./SceneRegistry";
import type { Scene } from "./types";

/** Minimal stand-in for a Container-based scene (no pixi renderer in node). */
function makeFakeScene() {
  return {
    init: vi.fn(async () => undefined),
    update: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
  };
}

type FakeScene = ReturnType<typeof makeFakeScene>;

function asScene(fake: FakeScene): Scene {
  return fake as unknown as Scene;
}

describe("engine/SceneRegistry", () => {
  it("register + has report registered ids only", () => {
    const registry = new SceneRegistry();

    expect(registry.has("level")).toBe(false);
    registry.register("level", () => asScene(makeFakeScene()));
    expect(registry.has("level")).toBe(true);
    expect(registry.has("never-registered")).toBe(false);
  });

  it("create returns exactly what the factory produces", () => {
    const registry = new SceneRegistry();
    const scene = asScene(makeFakeScene());
    const factory = vi.fn(() => scene);
    registry.register("level", factory);

    expect(registry.create("level")).toBe(scene);
  });

  it("create forwards params to the factory", () => {
    const registry = new SceneRegistry();
    const factory = vi.fn(() => asScene(makeFakeScene()));
    registry.register("level", factory);

    const params = { levelId: "level1" };
    registry.create("level", params);

    expect(factory).toHaveBeenCalledWith(params);
  });

  it("create with no params calls the factory with undefined", () => {
    const registry = new SceneRegistry();
    const factory = vi.fn(() => asScene(makeFakeScene()));
    registry.register("level", factory);

    registry.create("level");

    expect(factory).toHaveBeenCalledWith(undefined);
  });

  it("create throws on an unregistered id", () => {
    const registry = new SceneRegistry();

    expect(() => registry.create("missing")).toThrow("Unknown scene: missing");
  });

  it("registering the same id twice overwrites the earlier factory", () => {
    const registry = new SceneRegistry();
    const firstScene = asScene(makeFakeScene());
    const secondScene = asScene(makeFakeScene());
    const firstFactory = vi.fn(() => firstScene);
    const secondFactory = vi.fn(() => secondScene);

    registry.register("level", firstFactory);
    registry.register("level", secondFactory);

    expect(registry.has("level")).toBe(true);
    expect(registry.create("level")).toBe(secondScene);
    expect(firstFactory).not.toHaveBeenCalled();
    expect(secondFactory).toHaveBeenCalledOnce();
  });
});

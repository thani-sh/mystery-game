import { beforeEach, describe, expect, it, vi } from "vitest";
import type { Application } from "pixi.js";
import { SceneManager } from "./SceneManager";
import type { Scene } from "./types";

// --- Window stub -------------------------------------------------------------
// SceneManager's constructor registers a window resize listener; vitest runs
// in node (no DOM), so provide a minimal stand-in before any manager exists.
const resizeListeners: Array<() => void> = [];

const windowStub = {
  innerWidth: 1280,
  innerHeight: 720,
  addEventListener: (_type: string, listener: () => void) => {
    resizeListeners.push(listener);
  },
} as unknown as Window & typeof globalThis;

(globalThis as { window?: unknown }).window = windowStub;

// --- Fakes -------------------------------------------------------------------

/** Minimal stand-in for a Container-based scene (no pixi renderer in node). */
function makeFakeScene() {
  return {
    init: vi.fn(async () => {}),
    update: vi.fn(),
    resize: vi.fn(),
    destroy: vi.fn(),
  };
}

type FakeScene = ReturnType<typeof makeFakeScene>;

function asScene(fake: FakeScene): Scene {
  return fake as unknown as Scene;
}

function makeFakeApp() {
  const children: unknown[] = [];
  const stage = {
    addChild: vi.fn((child: unknown) => {
      children.push(child);
      return child;
    }),
    removeChild: vi.fn((child: unknown) => {
      const index = children.indexOf(child);
      if (index >= 0) children.splice(index, 1);
    }),
  };
  const tickerCallbacks: Array<() => void> = [];
  const ticker = {
    deltaTime: 1 / 60,
    add: vi.fn((cb: () => void) => {
      tickerCallbacks.push(cb);
    }),
  };
  const app = { stage, ticker } as unknown as Application;
  return { app, children, tickerCallbacks, stage };
}

beforeEach(() => {
  resizeListeners.length = 0;
  vi.clearAllMocks();
});

describe("engine/SceneManager", () => {
  it("register delegates to the registry", async () => {
    const { app } = makeFakeApp();
    const manager = new SceneManager(app);
    const scene = asScene(makeFakeScene());
    manager.register("level", () => scene);

    expect(manager.register).toBeDefined();
    await manager.goto("level");
    // Reached here without an "Unknown scene" throw => registry had the id.
    expect(scene.init).toHaveBeenCalled();
  });

  it("goto instantiates, adds to stage, awaits init, then resizes", async () => {
    const { app, children, stage } = makeFakeApp();
    const manager = new SceneManager(app);
    const scene = asScene(makeFakeScene());
    manager.register("level", () => scene);

    const resolved = await manager.goto("level", { levelId: "level1" });

    expect(resolved).toBeUndefined();
    expect(stage.addChild).toHaveBeenCalledWith(scene);
    expect(children).toEqual([scene]);
    expect(scene.init).toHaveBeenCalledWith({ levelId: "level1" });
    // Initial resize matches the window stub dimensions.
    expect(scene.resize).toHaveBeenCalledWith(1280, 720);
  });

  it("goto destroys the previous scene before adding the next", async () => {
    const { app, children, stage } = makeFakeApp();
    const manager = new SceneManager(app);
    const first = asScene(makeFakeScene());
    const second = asScene(makeFakeScene());
    manager.register("a", () => first);
    manager.register("b", () => second);

    await manager.goto("a");
    await manager.goto("b");

    expect(stage.removeChild).toHaveBeenCalledWith(first);
    expect(first.destroy).toHaveBeenCalledWith({ children: true });
    expect(stage.addChild).toHaveBeenLastCalledWith(second);
    expect(children).toEqual([second]);
    expect(second.init).toHaveBeenCalled();
  });

  it("window resizes are forwarded to the current scene", async () => {
    const { app } = makeFakeApp();
    const manager = new SceneManager(app);
    const scene = asScene(makeFakeScene());
    manager.register("a", () => scene);

    await manager.goto("a");
    expect(scene.resize).toHaveBeenCalledTimes(1); // initial resize from goto

    expect(resizeListeners).toHaveLength(1);
    resizeListeners[0]();

    expect(scene.resize).toHaveBeenLastCalledWith(1280, 720);
    expect(scene.resize).toHaveBeenCalledTimes(2);
  });

  it("start drives update() of the current scene from the ticker", async () => {
    const { app, tickerCallbacks } = makeFakeApp();
    const manager = new SceneManager(app);
    const scene = asScene(makeFakeScene());
    manager.register("a", () => scene);

    manager.start();
    expect(tickerCallbacks).toHaveLength(1);

    await manager.goto("a");
    tickerCallbacks[0]();

    expect(scene.update).toHaveBeenCalledWith(1 / 60);
  });

  it("ignores a goto that starts while another goto is in flight", async () => {
    const { app, children } = makeFakeApp();
    const manager = new SceneManager(app);

    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const slow = makeFakeScene();
    slow.init.mockReturnValue(gate);
    const fast = makeFakeScene();
    manager.register("slow", () => asScene(slow));
    manager.register("fast", () => asScene(fast));

    const first = manager.goto("slow");
    const second = manager.goto("fast"); // must be ignored while first in flight

    await expect(second).resolves.toBeUndefined();

    release();
    await Promise.all([first, second]);

    // The second (ignored) goto never created or destroyed anything.
    expect(children).toEqual([asScene(slow)]);
    expect(slow.destroy).not.toHaveBeenCalled();
    expect(fast.init).not.toHaveBeenCalled();
  });

  it("removes a scene that fails init instead of leaking it", async () => {
    const { app, children, stage } = makeFakeApp();
    const manager = new SceneManager(app);
    const bad = makeFakeScene();
    bad.init.mockRejectedValue(new Error("asset load failed"));
    manager.register("bad", () => asScene(bad));

    await expect(manager.goto("bad")).rejects.toThrow("asset load failed");

    expect(stage.removeChild).toHaveBeenCalledWith(asScene(bad));
    expect(bad.destroy).toHaveBeenCalledWith({ children: true });
    expect(children).toEqual([]);
  });
});

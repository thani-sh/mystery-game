import { afterEach, describe, expect, it, vi } from "vitest";
import type { Action } from "../data/types";
import { runActions } from "./ActionRunner";

/** Fresh spies shaped like a WorldHooks (kept un-annotated so they stay mocks). */
function createHooks() {
  return {
    moveActor: vi.fn(),
    setFlag: vi.fn(),
    clearFlag: vi.fn(),
    loadLevel: vi.fn(),
    message: vi.fn(),
  };
}

describe("game/systems/ActionRunner — runActions", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("dispatches move_actor to hooks.moveActor with the actor id and target", () => {
    const hooks = createHooks();

    runActions(
      [{ type: "move_actor", actorId: "daisy", target: { x: 120, y: 300 } }],
      hooks,
    );

    expect(hooks.moveActor).toHaveBeenCalledTimes(1);
    expect(hooks.moveActor).toHaveBeenCalledWith("daisy", { x: 120, y: 300 });
  });

  it("routes the legacy move_character action through hooks.moveActor", () => {
    const hooks = createHooks();

    runActions(
      [{ type: "move_character", characterId: "goon", target: { x: 5, y: 6 } }],
      hooks,
    );

    expect(hooks.moveActor).toHaveBeenCalledTimes(1);
    expect(hooks.moveActor).toHaveBeenCalledWith("goon", { x: 5, y: 6 });
    expect(hooks.setFlag).not.toHaveBeenCalled();
    expect(hooks.clearFlag).not.toHaveBeenCalled();
    expect(hooks.loadLevel).not.toHaveBeenCalled();
    expect(hooks.message).not.toHaveBeenCalled();
  });

  it("set_flag and clear_flag forward the flag name to the matching hooks", () => {
    const hooks = createHooks();

    runActions(
      [
        { type: "set_flag", flag: "door_open" },
        { type: "clear_flag", flag: "door_open" },
      ],
      hooks,
    );

    expect(hooks.setFlag).toHaveBeenCalledTimes(1);
    expect(hooks.setFlag).toHaveBeenCalledWith("door_open");
    expect(hooks.clearFlag).toHaveBeenCalledTimes(1);
    expect(hooks.clearFlag).toHaveBeenCalledWith("door_open");
  });

  it("load_level forwards the level id alone when no spawn is given", () => {
    const hooks = createHooks();

    runActions([{ type: "load_level", levelId: "level2" }], hooks);

    expect(hooks.loadLevel).toHaveBeenCalledTimes(1);
    expect(hooks.loadLevel).toHaveBeenCalledWith("level2", undefined);
  });

  it("load_level forwards the spawn point when one is provided", () => {
    const hooks = createHooks();

    runActions(
      [
        {
          type: "load_level",
          levelId: "level2",
          spawn: { x: 640, y: 480 },
        },
      ],
      hooks,
    );

    expect(hooks.loadLevel).toHaveBeenCalledTimes(1);
    expect(hooks.loadLevel).toHaveBeenCalledWith("level2", { x: 640, y: 480 });
  });

  it("message forwards the text to hooks.message", () => {
    const hooks = createHooks();

    runActions([{ type: "message", text: "A knock at the door." }], hooks);

    expect(hooks.message).toHaveBeenCalledTimes(1);
    expect(hooks.message).toHaveBeenCalledWith("A knock at the door.");
  });

  it("runs a mixed script in order, dispatching exactly once per action", () => {
    const hooks = createHooks();
    const order: string[] = [];
    hooks.moveActor.mockImplementation((actorId: string) =>
      order.push(`move:${actorId}`),
    );
    hooks.setFlag.mockImplementation((flag: string) =>
      order.push(`set:${flag}`),
    );
    hooks.message.mockImplementation((text: string) =>
      order.push(`msg:${text}`),
    );

    runActions(
      [
        { type: "set_flag", flag: "met_daisy" },
        {
          type: "move_character",
          characterId: "daisy",
          target: { x: 1, y: 2 },
        },
        { type: "move_actor", actorId: "goon", target: { x: 3, y: 4 } },
        { type: "message", text: "Hi" },
        { type: "set_flag", flag: "met_goon" },
      ],
      hooks,
    );

    expect(order).toEqual([
      "set:met_daisy",
      "move:daisy",
      "move:goon",
      "msg:Hi",
      "set:met_goon",
    ]);
    expect(hooks.moveActor).toHaveBeenCalledTimes(2);
    expect(hooks.setFlag).toHaveBeenCalledTimes(2);
    expect(hooks.clearFlag).not.toHaveBeenCalled();
    expect(hooks.loadLevel).not.toHaveBeenCalled();
    expect(hooks.message).toHaveBeenCalledTimes(1);
  });

  it("does nothing (and never throws) for an empty action list", () => {
    const hooks = createHooks();

    expect(() => runActions([], hooks)).not.toThrow();

    expect(hooks.moveActor).not.toHaveBeenCalled();
    expect(hooks.setFlag).not.toHaveBeenCalled();
    expect(hooks.clearFlag).not.toHaveBeenCalled();
    expect(hooks.loadLevel).not.toHaveBeenCalled();
    expect(hooks.message).not.toHaveBeenCalled();
  });

  it("warns and skips unknown action shapes without throwing", () => {
    const hooks = createHooks();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});

    const unknown = { type: "teleport", x: 5 } as unknown as Action;

    expect(() =>
      runActions([{ type: "set_flag", flag: "kept" }, unknown], hooks),
    ).not.toThrow();

    expect(hooks.setFlag).toHaveBeenCalledTimes(1);
    expect(hooks.setFlag).toHaveBeenCalledWith("kept");
    expect(hooks.moveActor).not.toHaveBeenCalled();
    expect(warn).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});

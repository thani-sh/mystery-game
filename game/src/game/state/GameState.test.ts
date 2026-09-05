import { describe, expect, it } from "vitest";
import { GameState } from "./GameState";

describe("GameState", () => {
  it("initial state has no flags and a null levelId/position", () => {
    const state = GameState.create();

    expect(state.hasFlag("anything")).toBe(false);
    expect(state.flags).toEqual({});
    expect(state.levelId).toBeNull();
    expect(state.position).toBeNull();
  });

  it("setFlag / clearFlag flip hasFlag for a single flag", () => {
    const state = GameState.create();

    state.setFlag("door_unlocked");
    expect(state.hasFlag("door_unlocked")).toBe(true);

    state.clearFlag("door_unlocked");
    expect(state.hasFlag("door_unlocked")).toBe(false);
  });

  it("flags are independent of each other", () => {
    const state = GameState.create();

    state.setFlag("a");
    state.setFlag("b");
    state.clearFlag("b");

    expect(state.hasFlag("a")).toBe(true);
    expect(state.hasFlag("b")).toBe(false);
  });

  it("clearing an unset flag is a no-op", () => {
    const state = GameState.create();

    state.clearFlag("never_set");
    expect(state.hasFlag("never_set")).toBe(false);
    expect(state.flags).toEqual({});
  });

  it("flags record reflects only the flags that are currently set", () => {
    const state = GameState.create();

    state.setFlag("a");
    state.setFlag("b");
    state.clearFlag("a");

    expect(state.flags).toEqual({ b: true });
  });

  it("setting the same flag twice stays set exactly once", () => {
    const state = GameState.create();

    state.setFlag("x");
    state.setFlag("x");

    expect(state.flags).toEqual({ x: true });
    expect(state.hasFlag("x")).toBe(true);
  });

  it("enterLevel sets levelId and position", () => {
    const state = GameState.create();

    state.enterLevel("level2", { x: 100, y: 200 });

    expect(state.levelId).toBe("level2");
    expect(state.position).toEqual({ x: 100, y: 200 });
  });

  it("enterLevel replaces a previous level/position on transition", () => {
    const state = GameState.create();

    state.enterLevel("level1", { x: 10, y: 20 });
    state.enterLevel("level3", { x: 30, y: 40 });

    expect(state.levelId).toBe("level3");
    expect(state.position).toEqual({ x: 30, y: 40 });
  });
});

import { describe, expect, it, vi } from "vitest";
import type { LevelExit, Position, Rectangle, Trigger } from "../data/types";
import { exitAt, flagNameFor, overlappingTriggers, pointInZone } from "./zones";

const rect = (x: number, y: number, w: number, h: number): Rectangle => ({
  x,
  y,
  w,
  h,
});

const at = (x: number, y: number): Position => ({ x, y });

describe("game/systems/zones — pointInZone", () => {
  it("is true for a point strictly inside the zone", () => {
    expect(pointInZone(at(5, 5), rect(0, 0, 10, 10))).toBe(true);
  });

  it("includes the left and top edges (min bounds are inclusive)", () => {
    expect(pointInZone(at(0, 5), rect(0, 0, 10, 10))).toBe(true);
    expect(pointInZone(at(5, 0), rect(0, 0, 10, 10))).toBe(true);
    expect(pointInZone(at(0, 0), rect(0, 0, 10, 10))).toBe(true);
  });

  it("excludes the right and bottom edges (max bounds are half-open)", () => {
    expect(pointInZone(at(10, 5), rect(0, 0, 10, 10))).toBe(false);
    expect(pointInZone(at(5, 10), rect(0, 0, 10, 10))).toBe(false);
    expect(pointInZone(at(10, 10), rect(0, 0, 10, 10))).toBe(false);
  });

  it("is false just outside each side of the zone", () => {
    const z = rect(100, 200, 50, 60);
    expect(pointInZone(at(99, 220), z)).toBe(false); // left
    expect(pointInZone(at(151, 220), z)).toBe(false); // right
    expect(pointInZone(at(120, 199), z)).toBe(false); // above
    expect(pointInZone(at(120, 261), z)).toBe(false); // below
  });

  it("works with non-zero zone origins and non-integer points", () => {
    expect(pointInZone(at(10.5, 20.5), rect(10, 20, 5, 5))).toBe(true);
    expect(pointInZone(at(15, 25), rect(10, 20, 5, 5))).toBe(false);
  });
});

describe("game/systems/zones — flagNameFor", () => {
  it("namespaces a trigger flag as trigger:<levelId>:<triggerId>", () => {
    expect(flagNameFor("level1", "gate")).toBe("trigger:level1:gate");
    expect(flagNameFor("level2", "intro")).toBe("trigger:level2:intro");
  });
});

describe("game/systems/zones — overlappingTriggers", () => {
  const onceTrigger = (id: string, zone: Rectangle): Trigger => ({
    id,
    zone,
    scriptId: `script_${id}`,
    once: true,
  });
  const repeatTrigger = (id: string, zone: Rectangle): Trigger => ({
    id,
    zone,
    scriptId: `script_${id}`,
    once: false,
  });
  const neverFires = vi.fn(() => false);

  it("returns [] when the level has no triggers", () => {
    expect(
      overlappingTriggers({ id: "level1" }, at(50, 50), neverFires),
    ).toEqual([]);
  });

  it("returns the triggers whose zone contains the position", () => {
    const t1 = onceTrigger("t1", rect(0, 0, 100, 100));
    const t2 = onceTrigger("t2", rect(200, 200, 10, 10));

    expect(
      overlappingTriggers(
        { id: "level1", triggers: [t1, t2] },
        at(10, 10),
        neverFires,
      ),
    ).toEqual([t1]);
  });

  it("keeps content order when several zones overlap the point", () => {
    const t1 = onceTrigger("t1", rect(0, 0, 100, 100));
    const t2 = onceTrigger("t2", rect(50, 50, 100, 100));

    expect(
      overlappingTriggers(
        { id: "level1", triggers: [t1, t2] },
        at(60, 60),
        neverFires,
      ),
    ).toEqual([t1, t2]);
  });

  it("excludes a once trigger whose consumption flag is already set", () => {
    const t = onceTrigger("gate", rect(0, 0, 100, 100));
    const consumed = vi.fn((flag: string) => flag === "trigger:level1:gate");

    expect(
      overlappingTriggers({ id: "level1", triggers: [t] }, at(5, 5), consumed),
    ).toEqual([]);
    expect(consumed).toHaveBeenCalledWith("trigger:level1:gate");
  });

  it("includes a once trigger whose consumption flag is not set", () => {
    const t = onceTrigger("gate", rect(0, 0, 100, 100));

    expect(
      overlappingTriggers(
        { id: "level1", triggers: [t] },
        at(5, 5),
        neverFires,
      ),
    ).toEqual([t]);
  });

  it("always includes a once:false trigger, even if its flag is set", () => {
    const t = repeatTrigger("beacon", rect(0, 0, 100, 100));
    const flagged = vi.fn(() => true);

    expect(
      overlappingTriggers({ id: "level1", triggers: [t] }, at(5, 5), flagged),
    ).toEqual([t]);
    expect(flagged).not.toHaveBeenCalled();
  });

  it("mixes consumed once and active triggers in one pass", () => {
    const consumedOnce = onceTrigger("done", rect(0, 0, 100, 100));
    const freshOnce = onceTrigger("fresh", rect(0, 0, 100, 100));
    const repeat = repeatTrigger("repeat", rect(0, 0, 100, 100));
    const has = (flag: string) => flag === "trigger:level1:done";

    expect(
      overlappingTriggers(
        { id: "level1", triggers: [consumedOnce, freshOnce, repeat] },
        at(1, 1),
        has,
      ),
    ).toEqual([freshOnce, repeat]);
  });

  it("respects the half-open zone boundary for membership", () => {
    const t = onceTrigger("edge", rect(0, 0, 10, 10));

    expect(
      overlappingTriggers(
        { id: "level1", triggers: [t] },
        at(10, 5),
        neverFires,
      ),
    ).toEqual([]); // on the exclusive right edge
    expect(
      overlappingTriggers(
        { id: "level1", triggers: [t] },
        at(9, 9),
        neverFires,
      ),
    ).toEqual([t]); // just inside the corner
  });
});

describe("game/systems/zones — exitAt", () => {
  const exit = (id: string, zone: Rectangle): LevelExit => ({
    id,
    zone,
    targetLevel: "level2",
    spawn: { x: 100, y: 100 },
  });

  it("returns undefined when the level has no exits", () => {
    expect(exitAt({}, at(5, 5))).toBeUndefined();
  });

  it("returns undefined when no exit zone contains the position", () => {
    expect(
      exitAt({ exits: [exit("e1", rect(0, 0, 10, 10))] }, at(50, 50)),
    ).toBeUndefined();
  });

  it("returns the exit whose zone contains the position", () => {
    const e = exit("e1", rect(0, 0, 10, 10));

    expect(exitAt({ exits: [e] }, at(5, 5))).toBe(e);
  });

  it("returns the first matching exit when zones overlap (first wins)", () => {
    const e1 = exit("e1", rect(0, 0, 100, 100));
    const e2 = exit("e2", rect(50, 50, 100, 100));

    expect(exitAt({ exits: [e1, e2] }, at(60, 60))).toBe(e1);
  });

  it("does not match a position on the exclusive boundary", () => {
    expect(
      exitAt({ exits: [exit("e1", rect(0, 0, 10, 10))] }, at(10, 5)),
    ).toBeUndefined();
  });
});

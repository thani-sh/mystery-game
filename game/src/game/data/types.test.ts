import { describe, expect, expectTypeOf, it } from "vitest";
import * as types from "./types";

// All exports in types.ts are compile-time-only types (fully erased at
// runtime), so the runtime assertions are limited to the module itself
// resolving through the vitest pipeline. The type-level assertions below pin
// the export surface: if a named export disappears, `tsc --noEmit` fails.
describe("game/data/types module", () => {
  it("loads through the vitest pipeline", () => {
    expect(types).toBeDefined();
    expect(typeof types).toBe("object");
  });

  it("still exports every core content type name", () => {
    expectTypeOf<types.Position>().not.toBeNever();
    expectTypeOf<types.ActorConfig>().not.toBeNever();
    expectTypeOf<types.Action>().not.toBeNever();
    expectTypeOf<types.DialogueChoice>().not.toBeNever();
    expectTypeOf<types.DialogueNode>().not.toBeNever();
    expectTypeOf<types.LevelConfig>().not.toBeNever();
    expectTypeOf<types.Rectangle>().not.toBeNever();
  });
});

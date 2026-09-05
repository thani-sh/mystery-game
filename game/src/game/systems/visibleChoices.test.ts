import { describe, expect, it, vi } from "vitest";
import type { DialogueChoice } from "../data/types";
import { visibleChoices } from "./visibleChoices";

// The flag-gating fields (requiresFlag/blocksFlag) are an additive content
// schema extension not yet present on the shared DialogueChoice type, so the
// fixtures carry them through a widening cast (same route real level JSON
// takes: extra fields are ignored by the base type).
function choice(
  overrides: {
    text?: string;
    requiresFlag?: string;
    blocksFlag?: string;
  } = {},
): DialogueChoice {
  return { text: "option", ...overrides } as DialogueChoice;
}

function has(flag: string): boolean {
  return ["met_daisy", "gate_open"].includes(flag);
}

describe("game/systems/visibleChoices", () => {
  it("returns [] for an undefined choice list", () => {
    expect(visibleChoices(undefined, has)).toEqual([]);
  });

  it("keeps unconstrained choices untouched", () => {
    const choices = [choice({ text: "a" }), choice({ text: "b" })];

    expect(visibleChoices(choices, has)).toEqual(choices);
  });

  it("keeps a choice whose requiresFlag is satisfied", () => {
    const choices = [
      choice({ text: "ask about daisy", requiresFlag: "met_daisy" }),
    ];

    expect(visibleChoices(choices, has)).toEqual(choices);
  });

  it("hides a choice whose requiresFlag is not set", () => {
    const choices = [choice({ text: "secret", requiresFlag: "never_met" })];

    expect(visibleChoices(choices, has)).toEqual([]);
  });

  it("keeps a choice whose blocksFlag is not set", () => {
    const choices = [
      choice({ text: "ask again", blocksFlag: "asked_already" }),
    ];

    expect(visibleChoices(choices, has)).toEqual(choices);
  });

  it("hides a choice whose blocksFlag is already set", () => {
    const choices = [choice({ text: "ask again", blocksFlag: "met_daisy" })];

    expect(visibleChoices(choices, has)).toEqual([]);
  });

  it("hides gated choices and preserves the order of the survivors", () => {
    const choices = [
      choice({ text: "plain one" }),
      choice({ text: "needs met", requiresFlag: "met_daisy" }),
      choice({ text: "already done", blocksFlag: "met_daisy" }),
      choice({
        text: "blocked + required",
        requiresFlag: "missing",
        blocksFlag: "gate_open",
      }),
      choice({ text: "last plain" }),
    ];

    expect(visibleChoices(choices, has).map((c) => c.text)).toEqual([
      "plain one",
      "needs met",
      "last plain",
    ]);
  });

  it("treats an empty list as empty without querying flags", () => {
    const hasFlag = vi.fn(() => true);

    expect(visibleChoices([], hasFlag)).toEqual([]);
    expect(hasFlag).not.toHaveBeenCalled();
  });
});

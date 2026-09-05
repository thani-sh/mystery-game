// Pure flag-gating for dialogue choices: entries whose `requiresFlag` is not
// set are hidden, and entries whose `blocksFlag` is already set are hidden
// (that option was already taken / exhausted). Survivors keep their original
// order, so renderers can number them 1..N and the keyboard/pointer index maps
// straight onto the same filtered array the picker uses.
import type { DialogueChoice } from "../data/types";

/**
 * Flag-gating fields a choice may carry in level content. They are an additive
 * schema extension that the shared DialogueChoice type gains in a later phase,
 * so they are declared here and read defensively (extra JSON fields simply
 * widen past the base type at the content boundary).
 */
interface ChoiceGates {
  requiresFlag?: string;
  blocksFlag?: string;
}

/**
 * Filter `choices` down to the ones the player may currently pick, given the
 * flag predicate `hasFlag`. `undefined`/absent choice lists yield `[]`.
 */
export function visibleChoices(
  choices: DialogueChoice[] | undefined,
  hasFlag: (flag: string) => boolean,
): DialogueChoice[] {
  if (!choices) return [];

  return choices.filter((choice) => {
    const gates = choice as DialogueChoice & ChoiceGates;

    if (gates.requiresFlag !== undefined && !hasFlag(gates.requiresFlag)) {
      return false;
    }
    if (gates.blocksFlag !== undefined && hasFlag(gates.blocksFlag)) {
      return false;
    }
    return true;
  });
}

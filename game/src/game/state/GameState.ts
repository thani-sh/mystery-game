import type { Position } from "../data/types";

/**
 * Pure game state service: flags plus the current level / player position.
 *
 * Deliberately free of Pixi/DOM imports so it can be unit-tested in a plain
 * node environment and survives level transitions unchanged.
 */
export class GameState {
  private _flags: Record<string, boolean> = {};

  levelId: string | null = null;

  position: Position | null = null;

  static create(): GameState {
    return new GameState();
  }

  setFlag(name: string): void {
    this._flags[name] = true;
  }

  clearFlag(name: string): void {
    delete this._flags[name];
  }

  hasFlag(name: string): boolean {
    return this._flags[name] === true;
  }

  /** Snapshot of the currently-set flags (safe to read/compare, no live ref). */
  get flags(): Readonly<Record<string, boolean>> {
    return { ...this._flags };
  }

  enterLevel(levelId: string, position: Position): void {
    this.levelId = levelId;
    this.position = { ...position };
  }
}

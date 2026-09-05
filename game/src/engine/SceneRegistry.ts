import type { Scene } from "./types";

/** Builds a Scene instance, optionally parameterized (e.g. `{ levelId }`). */
export type SceneFactory = (params?: unknown) => Scene;

/**
 * Pure `id -> factory` registry for scenes. No pixi dependency and no side
 * effects, so it is trivially unit-testable in a node environment.
 *
 * Registering an id twice overwrites the earlier registration (last wins).
 */
export class SceneRegistry {
  private readonly factories = new Map<string, SceneFactory>();

  register(id: string, factory: SceneFactory): void {
    this.factories.set(id, factory);
  }

  has(id: string): boolean {
    return this.factories.has(id);
  }

  create(id: string, params?: unknown): Scene {
    const factory = this.factories.get(id);
    if (!factory) {
      throw new Error(`Unknown scene: ${id}`);
    }
    return factory(params);
  }
}

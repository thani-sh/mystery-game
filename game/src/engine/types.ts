import type { Container } from "pixi.js";

/**
 * A Scene is a Container attached to the stage that follows a standard
 * lifecycle: `init` (once, before first frame), `update` (every tick) and
 * `resize` (on viewport changes and right after init).
 *
 * Any Container subclass that implements these members satisfies this
 * interface structurally — no base class or mixin is required.
 */
export interface Scene extends Container {
  /** One-time async setup (asset loading, world construction). */
  init(params?: unknown): Promise<void>;
  /** Advance simulation by `delta` (ticker deltaTime). */
  update(delta: number): void;
  /** Re-layout for a new viewport size. */
  resize(width: number, height: number): void;
}

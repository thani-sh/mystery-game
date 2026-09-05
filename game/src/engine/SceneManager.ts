import type { Application } from "pixi.js";
import { SceneRegistry } from "./SceneRegistry";
import type { SceneFactory } from "./SceneRegistry";
import type { Scene } from "./types";

/**
 * Owns the currently running scene: swapping between registered scenes,
 * feeding them ticker updates and forwarding window resizes.
 *
 * Usage (once, at boot):
 *   const scenes = new SceneManager(app);
 *   scenes.register("level", (params) => new GameScreen(...));
 *   scenes.start();                       // pump update() from the ticker
 *   await scenes.goto("level", params);   // make a scene current
 */
export class SceneManager {
  private readonly app: Application;
  private readonly registry = new SceneRegistry();
  private current: Scene | null = null;
  private switching = false;

  constructor(app: Application) {
    this.app = app;
    window.addEventListener("resize", () => {
      this.current?.resize(window.innerWidth, window.innerHeight);
    });
  }

  register(id: string, factory: SceneFactory): void {
    this.registry.register(id, factory);
  }

  /**
   * Swap to a registered scene by id.
   *
   * Destroys the outgoing scene (stage + children), instantiates the next one
   * from the registry, adds it to the stage, awaits its `init(params)`, then
   * gives it an initial `resize` before marking it current.
   *
   * Guard: a `goto` that starts while another is still in flight is ignored
   * (simple boolean) — this prevents destroying a scene twice when callers
   * race. Scenes that fail `init` are removed from the stage rather than
   * leaking half-initialized.
   */
  async goto(id: string, params?: unknown): Promise<void> {
    if (this.switching) return;
    this.switching = true;
    try {
      if (this.current) {
        this.app.stage.removeChild(this.current);
        this.current.destroy({ children: true });
        this.current = null;
      }

      const next = this.registry.create(id, params);
      this.app.stage.addChild(next);

      try {
        await next.init(params);
      } catch (error) {
        this.app.stage.removeChild(next);
        next.destroy({ children: true });
        throw error;
      }

      next.resize(window.innerWidth, window.innerHeight);
      this.current = next;
    } finally {
      this.switching = false;
    }
  }

  /** Drive the current scene's `update` from the application ticker. Call once. */
  start(): void {
    this.app.ticker.add(() => {
      this.current?.update(this.app.ticker.deltaTime);
    });
  }
}

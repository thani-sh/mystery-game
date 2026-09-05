import { Application } from "pixi.js";
import { LevelScene } from "./app/screens/LevelScene";
import { SceneManager } from "./engine/SceneManager";
import { InputSystem } from "./engine/utils/Input";
import { gameConfig } from "./game/data/content";
import { GameState } from "./game/state/GameState";
import type { Position } from "./game/data/types";

/** Optional params accepted by the registered "level" scene factory. */
interface LevelSceneParams {
  levelId?: string;
  spawn?: Position;
}

(async () => {
  // Initialize input
  InputSystem.getInstance();

  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#1099bb", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // The scene framework owns the ticker pump and window-resize wiring now.
  const scenes = new SceneManager(app);
  scenes.start();

  // One shared GameState for every level scene: flags set through dialogue
  // actions persist when a load_level action jumps between levels.
  const gameState = GameState.create();

  scenes.register("level", (params) => {
    const p = (params as LevelSceneParams | undefined) ?? {};
    const levelId = p.levelId ?? gameConfig.startLevel;
    // LevelScene resolves the level config itself through the ContentIndex
    // (lookupLevel) and throws "Unknown level: <id>" for unknown ids. A spawn
    // carried in the goto params is applied in LevelScene.init().
    return new LevelScene(levelId, {
      gameState,
      onLoadLevel: (levelId, spawn) => scenes.goto("level", { levelId, spawn }),
    });
  });

  // Boot the configured start scene (gameConfig.startScene === "level") on
  // the configured start level — identical boot to before this refactor.
  await scenes.goto(gameConfig.startScene, {
    levelId: gameConfig.startLevel,
  });
})();

import { Application } from "pixi.js";
import { LevelScene } from "./app/screens/LevelScene";
import { SceneManager } from "./engine/SceneManager";
import { InputSystem } from "./engine/utils/Input";
import { gameConfig } from "./game/data/content";

/** Optional params accepted by the registered "level" scene factory. */
interface LevelSceneParams {
  levelId?: string;
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

  scenes.register("level", (params) => {
    const levelId =
      (params as LevelSceneParams | undefined)?.levelId ??
      gameConfig.startLevel;
    // LevelScene resolves the level config itself through the ContentIndex
    // (lookupLevel) and throws "Unknown level: <id>" for unknown ids.
    return new LevelScene(levelId);
  });

  // Boot the configured start scene (gameConfig.startScene === "level") on
  // the configured start level — identical boot to before this refactor.
  await scenes.goto(gameConfig.startScene, {
    levelId: gameConfig.startLevel,
  });
})();

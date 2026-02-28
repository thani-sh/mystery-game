import { Application } from "pixi.js";
import { GameScreen } from "./app/screens/GameScreen";
import { level } from "./game/data/poc-data";
import { InputSystem } from "./engine/utils/Input";

(async () => {
  // Initialize input
  InputSystem.getInstance();

  // Create a new application
  const app = new Application();

  // Initialize the application
  await app.init({ background: "#1099bb", resizeTo: window });

  // Append the application canvas to the document body
  document.getElementById("pixi-container")!.appendChild(app.canvas);

  // Initialize Game Screen
  const gameScreen = new GameScreen(level);

  // Initial resize
  gameScreen.resize(app.screen.width, app.screen.height);

  // Add the game screen to the stage
  app.stage.addChild(gameScreen);

  // Listen for animate update
  app.ticker.add((ticker) => {
    gameScreen.update(ticker.deltaTime);
  });

  // Handle window resize
  window.addEventListener("resize", () => {
    gameScreen.resize(window.innerWidth, window.innerHeight);
  });
})();

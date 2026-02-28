export class InputSystem {
  private keys: Record<string, boolean> = {};
  private static instance: InputSystem;

  private constructor() {
    window.addEventListener("keydown", (e) => (this.keys[e.key] = true));
    window.addEventListener("keyup", (e) => (this.keys[e.key] = false));
  }

  public static getInstance(): InputSystem {
    if (!InputSystem.instance) {
      InputSystem.instance = new InputSystem();
    }
    return InputSystem.instance;
  }

  public isKeyDown(key: string): boolean {
    return !!this.keys[key];
  }

  // Clear keys (useful when opening menus)
  public clear() {
    this.keys = {};
  }
}

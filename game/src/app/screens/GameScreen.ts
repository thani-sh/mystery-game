import { Container, Graphics, Text, Assets, AnimatedSprite } from "pixi.js";
import {
  LevelData,
  Position,
  CharacterData,
  Action,
} from "../../game/data/types";
import { InputSystem } from "../../engine/utils/Input";

const TILE_SIZE = 64;

// Load all characters dynamically
const characterFiles = import.meta.glob("../../game/data/characters/*.json", {
  eager: true,
});
const characters: Record<string, CharacterData> = {};
for (const path in characterFiles) {
  const file = characterFiles[path] as Record<string, unknown>;
  const data = (file.default || file) as CharacterData;
  characters[data.id] = data;
}

export class GameScreen extends Container {
  private levelData: LevelData;
  private playerPos: Position;
  private mapContainer: Container;
  private actorsContainer: Container;
  private uiContainer: Container;

  private dialogueBox: Container;
  private dialogueText: Text;
  private choiceTexts: Text[] = [];

  private currentDialogueNodeId: string | null = null;

  private actorSprites: Record<string, AnimatedSprite> = {};
  private playerSprite!: AnimatedSprite;

  private moveTimer: number = 0;
  private readonly MOVE_DURATION: number = 15;
  private playerStartMovePos: Position;
  private playerDirection: "down" | "up" | "left" | "right" = "down";
  private playerState: "idle" | "walk" = "idle";

  private input: InputSystem;

  constructor(levelData: LevelData) {
    super();
    this.levelData = levelData;
    this.playerPos = { ...levelData.playerStart };
    this.playerStartMovePos = { ...levelData.playerStart };
    this.input = InputSystem.getInstance();

    this.mapContainer = new Container();
    this.actorsContainer = new Container();
    this.actorsContainer.sortableChildren = true; // enable Y-sorting
    this.uiContainer = new Container();

    this.addChild(this.mapContainer);
    this.addChild(this.actorsContainer);
    this.addChild(this.uiContainer);

    this.dialogueBox = new Container();
    this.dialogueText = new Text({
      text: "",
      style: {
        fontSize: 24,
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: 700,
      },
    });
  }

  public async init() {
    // Wait for assets to load before initializing actors
    this.initMap();
    this.initUI();
    await this.loadAndInitActors();
  }

  private async loadAndInitActors() {
    // Load Bets (Player)
    await Assets.load("/assets/actors/bets/frames/idle.json");
    await Assets.load("/assets/actors/bets/frames/walk.json");

    // Load Goon
    await Assets.load("/assets/actors/goon/frames/idle.json");
    await Assets.load("/assets/actors/goon/frames/walk.json");

    this.initActors();
  }

  private initMap() {
    for (const layer of this.levelData.tiles) {
      for (let y = 0; y < this.levelData.height; y++) {
        for (let x = 0; x < this.levelData.width; x++) {
          const tileType = layer[y][x];
          if (tileType === 0) continue;

          const rect = new Graphics();

          if (tileType === 1) {
            rect.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x228b22); // grass
          } else if (tileType === 2) {
            rect.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x808080); // road
          } else if (tileType === 3) {
            rect.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x006400); // tree
          } else {
            rect.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0xff00ff); // unknown
          }

          rect.position.set(x * TILE_SIZE, y * TILE_SIZE);
          this.mapContainer.addChild(rect);
        }
      }
    }
  }

  private initActors() {
    // Player
    const playerFrames = Assets.cache.get(
      "/assets/actors/bets/frames/idle.json",
    ).animations;
    this.playerSprite = new AnimatedSprite(playerFrames.down);
    const playerScale = characters["bets"]?.scale ?? 1;
    this.playerSprite.width = TILE_SIZE * playerScale;
    this.playerSprite.height = TILE_SIZE * playerScale;
    // Anchor to bottom-center so the character stands on their tile
    this.playerSprite.anchor.set(0.5, 1.0);
    this.playerSprite.animationSpeed = 0.1;
    this.playerSprite.position.set(
      this.playerPos.x * TILE_SIZE + TILE_SIZE / 2,
      this.playerPos.y * TILE_SIZE + TILE_SIZE,
    );
    this.playerSprite.zIndex = this.playerSprite.y;
    this.playerSprite.play();
    this.actorsContainer.addChild(this.playerSprite);

    // NPCs
    for (const char of this.levelData.characters) {
      // Set NPCs to look down and face idle by default
      const frames = Assets.cache.get(
        `/assets/actors/${char.id}/frames/idle.json`,
      )?.animations?.down || [Graphics]; // Fallback if missing

      // Avoid crash if assets missing
      if (!frames || frames.length === 0) continue;

      const sprite = new AnimatedSprite(frames);
      const charScale = characters[char.id]?.scale ?? 1;
      sprite.width = TILE_SIZE * charScale;
      sprite.height = TILE_SIZE * charScale;
      // Anchor to bottom-center so the character stands on their tile
      sprite.anchor.set(0.5, 1.0);
      sprite.animationSpeed = 0.1;
      sprite.position.set(
        char.position.x * TILE_SIZE + TILE_SIZE / 2,
        char.position.y * TILE_SIZE + TILE_SIZE,
      );
      sprite.zIndex = sprite.y;
      sprite.play();
      this.actorSprites[char.id] = sprite;
      this.actorsContainer.addChild(sprite);
    }

    // Initial camera update
    this.updateCamera();
  }

  private setActorAnimation(
    sprite: AnimatedSprite,
    actorId: string,
    state: "idle" | "walk",
    direction: "down" | "up" | "left" | "right",
  ) {
    const sheetKey = `/assets/actors/${actorId}/frames/${state}.json`;
    const sheet = Assets.cache.get(sheetKey);
    if (!sheet || !sheet.animations) return;

    const frames = sheet.animations[direction];
    if (frames && sprite.textures !== frames) {
      sprite.textures = frames;
      sprite.play();
    }
  }

  private initUI() {
    // Dialogue background
    const bg = new Graphics();
    bg.rect(0, 0, 800, 200).fill({ color: 0x000000, alpha: 0.8 });
    this.dialogueBox.addChild(bg);

    this.dialogueText.position.set(20, 20);
    this.dialogueBox.addChild(this.dialogueText);

    // Position at bottom of screen (assuming 800x600 for now)
    this.dialogueBox.position.set(
      (window.innerWidth - 800) / 2,
      window.innerHeight - 250,
    );
    this.dialogueBox.visible = false;

    this.uiContainer.addChild(this.dialogueBox);
  }

  public update(delta: number) {
    if (this.currentDialogueNodeId) {
      if (this.playerState === "walk") {
        this.playerState = "idle";
        this.setActorAnimation(
          this.playerSprite,
          "bets",
          this.playerState,
          this.playerDirection,
        );
      }
      this.handleDialogueInput();
      return; // Stop game loop if in dialogue
    }

    this.handleMovement(delta);
  }

  private handleMovement(delta: number) {
    if (this.moveTimer > 0) {
      this.moveTimer -= delta;

      // Interpolate position
      const progress = 1 - Math.max(0, this.moveTimer / this.MOVE_DURATION);
      const visualX =
        this.playerStartMovePos.x +
        (this.playerPos.x - this.playerStartMovePos.x) * progress;
      const visualY =
        this.playerStartMovePos.y +
        (this.playerPos.y - this.playerStartMovePos.y) * progress;

      this.playerSprite.position.set(
        visualX * TILE_SIZE + TILE_SIZE / 2,
        visualY * TILE_SIZE + TILE_SIZE,
      );
      this.playerSprite.zIndex = this.playerSprite.y;
      this.updateCamera(visualX, visualY);

      if (this.moveTimer <= 0) {
        // Snap to grid at end of movement
        this.playerSprite.position.set(
          this.playerPos.x * TILE_SIZE + TILE_SIZE / 2,
          this.playerPos.y * TILE_SIZE + TILE_SIZE,
        );
        this.playerState = "idle";
        this.setActorAnimation(
          this.playerSprite,
          "bets",
          this.playerState,
          this.playerDirection,
        );
      }
      return;
    }

    let dx = 0;
    let dy = 0;
    let newDirection = this.playerDirection;

    if (this.input.isKeyDown("ArrowUp") || this.input.isKeyDown("w")) {
      dy = -1;
      newDirection = "up";
    } else if (this.input.isKeyDown("ArrowDown") || this.input.isKeyDown("s")) {
      dy = 1;
      newDirection = "down";
    } else if (this.input.isKeyDown("ArrowLeft") || this.input.isKeyDown("a")) {
      dx = -1;
      newDirection = "left";
    } else if (
      this.input.isKeyDown("ArrowRight") ||
      this.input.isKeyDown("d")
    ) {
      dx = 1;
      newDirection = "right";
    }

    if (dx !== 0 || dy !== 0) {
      this.playerDirection = newDirection;
      const newX = this.playerPos.x + dx;
      const newY = this.playerPos.y + dy;

      if (this.canMoveTo(newX, newY)) {
        this.playerStartMovePos = { ...this.playerPos };
        this.playerPos.x = newX;
        this.playerPos.y = newY;

        this.moveTimer = this.MOVE_DURATION;
        this.playerState = "walk";
        this.setActorAnimation(
          this.playerSprite,
          "bets",
          this.playerState,
          this.playerDirection,
        );
      } else {
        // Prevent sliding into a wall but update direction
        this.setActorAnimation(
          this.playerSprite,
          "bets",
          "idle",
          this.playerDirection,
        );

        // Check interact
        const char = this.getCharacterAt(newX, newY);
        if (char && char.interactable && char.dialogueStart) {
          this.startDialogue(char.dialogueStart);
          this.moveTimer = this.MOVE_DURATION; // cooldown to prevent instant skip
        }
      }
    } else if (this.playerState === "walk") {
      this.playerState = "idle";
      this.setActorAnimation(
        this.playerSprite,
        "bets",
        this.playerState,
        this.playerDirection,
      );
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    if (
      x < 0 ||
      x >= this.levelData.width ||
      y < 0 ||
      y >= this.levelData.height
    )
      return false;

    // Check all layers for obstacles (1: grass, 3: tree)
    for (const layer of this.levelData.tiles) {
      const tileType = layer[y][x];
      if (tileType === 1 || tileType === 3) return false;
    }

    if (this.getCharacterAt(x, y)) return false;

    return true;
  }

  private getCharacterAt(x: number, y: number) {
    return this.levelData.characters.find(
      (c) => c.position.x === x && c.position.y === y,
    );
  }

  private startDialogue(dialogueStart: string) {
    if (this.levelData.dialogues && this.levelData.dialogues[dialogueStart]) {
      this.currentDialogueNodeId = dialogueStart;
      this.dialogueBox.visible = true;
      this.renderDialogueNode();
    }
  }

  private renderDialogueNode() {
    if (!this.currentDialogueNodeId || !this.levelData.dialogues) return;

    const node = this.levelData.dialogues[this.currentDialogueNodeId];
    if (!node) {
      this.endDialogue();
      return;
    }

    // Set speaker name + text
    const speakerName = characters[node.speaker]?.name || node.speaker;
    this.dialogueText.text = `${speakerName}: ${node.text}`;

    // Clear old choices
    this.choiceTexts.forEach((t) => t.destroy());
    this.choiceTexts = [];

    // Render new choices
    if (node.choices && node.choices.length > 0) {
      node.choices.forEach((choice, idx) => {
        const choiceText = new Text({
          text: `${idx + 1}. ${choice.text}`,
          style: { fontSize: 20, fill: 0xaaaaaa },
        });
        choiceText.position.set(40, 80 + idx * 30);
        this.dialogueBox.addChild(choiceText);
        this.choiceTexts.push(choiceText);
      });
    } else {
      const choiceText = new Text({
        text: `1. Continue`,
        style: { fontSize: 20, fill: 0xaaaaaa },
      });
      choiceText.position.set(40, 80);
      this.dialogueBox.addChild(choiceText);
      this.choiceTexts.push(choiceText);
    }
  }

  private handleDialogueInput() {
    if (!this.currentDialogueNodeId || !this.levelData.dialogues) return;
    const node = this.levelData.dialogues[this.currentDialogueNodeId];
    if (!node) return;

    const choices =
      node.choices && node.choices.length > 0
        ? node.choices
        : [{ text: "Continue" }];

    for (let i = 0; i < choices.length; i++) {
      if (this.input.isKeyDown((i + 1).toString())) {
        const choice = choices[i];

        if (choice.action) {
          this.executeAction(choice.action);
        }

        if (choice.scriptId && this.levelData.scripts) {
          const script = this.levelData.scripts[choice.scriptId];
          if (script) {
            script.forEach((action) => this.executeAction(action));
          }
        }

        if (choice.next) {
          this.currentDialogueNodeId = choice.next;
          this.renderDialogueNode();
          this.input.clear(); // clear keys so we don't double trigger
          return;
        } else {
          this.endDialogue();
          this.input.clear();
          return;
        }
      }
    }
  }

  private executeAction(action: Action) {
    if (action.type === "move_character") {
      const char = this.levelData.characters.find(
        (c) => c.id === action.characterId,
      );
      if (char) {
        char.position = { ...action.target };
        // update sprite
        if (this.actorSprites[char.id]) {
          this.actorSprites[char.id].position.set(
            char.position.x * TILE_SIZE + TILE_SIZE / 2,
            char.position.y * TILE_SIZE + TILE_SIZE,
          );
          this.actorSprites[char.id].zIndex = this.actorSprites[char.id].y;
        }
      }
    }
  }

  private endDialogue() {
    this.currentDialogueNodeId = null;
    this.dialogueBox.visible = false;
  }

  private updateCamera(
    visualTargetX: number = this.playerPos.x,
    visualTargetY: number = this.playerPos.y,
  ) {
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const mapWidth = this.levelData.width * TILE_SIZE;
    const mapHeight = this.levelData.height * TILE_SIZE;

    // Target camera position (center on player)
    let targetX = screenWidth / 2 - (visualTargetX * TILE_SIZE + TILE_SIZE / 2);
    let targetY =
      screenHeight / 2 - (visualTargetY * TILE_SIZE + TILE_SIZE / 2);

    // Clamp camera so it doesn't show outside the map
    if (mapWidth > screenWidth) {
      targetX = Math.max(screenWidth - mapWidth, Math.min(0, targetX));
    } else {
      targetX = (screenWidth - mapWidth) / 2; // Center if map is smaller than screen
    }

    if (mapHeight > screenHeight) {
      targetY = Math.max(screenHeight - mapHeight, Math.min(0, targetY));
    } else {
      targetY = (screenHeight - mapHeight) / 2;
    }

    this.mapContainer.position.set(Math.round(targetX), Math.round(targetY));
    this.actorsContainer.position.set(Math.round(targetX), Math.round(targetY));
  }

  // Handle window resize
  public resize(width: number, height: number) {
    this.dialogueBox.position.set((width - 800) / 2, height - 250);
    this.updateCamera();
  }
}

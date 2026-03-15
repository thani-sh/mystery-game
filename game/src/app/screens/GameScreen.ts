import {
  Container,
  Graphics,
  Text,
  Assets,
  AnimatedSprite,
  Sprite,
} from "pixi.js";
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

  private playerDirection: "down" | "up" | "left" | "right" = "down";
  private playerState: "idle" | "walk" = "idle";

  private input: InputSystem;

  // Throttle interactions
  private interactCooldown: number = 0;

  constructor(levelData: LevelData) {
    super();
    this.levelData = levelData;
    this.playerPos = { ...levelData.playerStart };
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
    // Load background image
    await Assets.load(this.levelData.background);

    // Wait for assets to load before initializing actors
    await this.loadAndInitActors();

    this.initMap();
    this.initUI();
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
    const texture = Assets.get(this.levelData.background);
    const bg = new Sprite(texture);
    const bgScale = this.levelData.scalingFactor ?? 1;
    // Scale background
    bg.scale.set(bgScale);
    this.mapContainer.addChild(bg);
  }

  private initActors() {
    const bgScale = this.levelData.scalingFactor ?? 1;

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
      this.playerPos.x * bgScale,
      this.playerPos.y * bgScale,
    );
    this.playerSprite.zIndex = this.playerSprite.y;
    this.playerSprite.play();
    this.actorsContainer.addChild(this.playerSprite);

    // NPCs
    for (const char of this.levelData.characters) {
      // Set NPCs to look down and face idle by default
      const frames =
        Assets.cache.get(`/assets/actors/${char.id}/frames/idle.json`)
          ?.animations?.down || []; // Fallback if missing

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
        char.position.x * bgScale,
        char.position.y * bgScale,
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
    if (this.interactCooldown > 0) {
      this.interactCooldown -= delta;
    }

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
    const speed = 4 * delta;
    const bgScale = this.levelData.scalingFactor ?? 1;

    let dx = 0;
    let dy = 0;
    let newDirection = this.playerDirection;

    if (this.input.isKeyDown("ArrowUp") || this.input.isKeyDown("w")) {
      dy = -1;
      newDirection = "up";
    } else if (this.input.isKeyDown("ArrowDown") || this.input.isKeyDown("s")) {
      dy = 1;
      newDirection = "down";
    }

    if (this.input.isKeyDown("ArrowLeft") || this.input.isKeyDown("a")) {
      dx = -1;
      newDirection = "left";
    } else if (
      this.input.isKeyDown("ArrowRight") ||
      this.input.isKeyDown("d")
    ) {
      dx = 1;
      newDirection = "right";
    }

    // Interaction handling - trigger talk if near an NPC
    if ((this.input.isKeyDown("e") || this.input.isKeyDown("Enter") || this.input.isKeyDown(" ")) && this.interactCooldown <= 0) {
      const interactRadius = 64; // distance in pixels
      const char = this.getCharacterNear(this.playerPos.x, this.playerPos.y, interactRadius);
      if (char && char.interactable && char.dialogueStart) {
        this.startDialogue(char.dialogueStart);
        this.interactCooldown = 10; // short cooldown
        return;
      }
    }

    if (dx !== 0 || dy !== 0) {
      // Normalize vector
      const length = Math.sqrt(dx * dx + dy * dy);
      dx = (dx / length) * speed;
      dy = (dy / length) * speed;

      this.playerDirection = newDirection;
      const newX = this.playerPos.x + dx;
      const newY = this.playerPos.y + dy;

      // Move independently in axes for sliding along walls
      if (this.canMoveTo(newX, this.playerPos.y)) {
        this.playerPos.x = newX;
      }
      if (this.canMoveTo(this.playerPos.x, newY)) {
        this.playerPos.y = newY;
      }

      this.playerState = "walk";
      this.setActorAnimation(
        this.playerSprite,
        "bets",
        this.playerState,
        this.playerDirection,
      );

      this.playerSprite.position.set(
        this.playerPos.x * bgScale,
        this.playerPos.y * bgScale,
      );
      this.playerSprite.zIndex = this.playerSprite.y;
      this.updateCamera();
    } else {
      if (this.playerState === "walk") {
        this.playerState = "idle";
        this.setActorAnimation(
          this.playerSprite,
          "bets",
          this.playerState,
          this.playerDirection,
        );
      }
    }
  }

  private canMoveTo(x: number, y: number): boolean {
    const rx = 16; // player collision radius/width
    const ry = 10; // player collision height

    // Convert to unscaled map pixels
    const px = x;
    const py = y;

    // Get true width/height from imageResolution
    const mapWidthInPixels = this.levelData.imageResolution.width;
    const mapHeightInPixels = this.levelData.imageResolution.height;

    if (
      px - rx < 0 ||
      px + rx > mapWidthInPixels ||
      py - ry * 2 < 0 ||
      py > mapHeightInPixels
    ) {
      return false;
    }

    if (this.levelData.collisions) {
      for (const rect of this.levelData.collisions) {
        // Simple AABB overlap check with the player's foot boundary
        if (
          px + rx > rect.x &&
          px - rx < rect.x + rect.w &&
          py > rect.y &&
          py - ry * 2 < rect.y + rect.h
        ) {
          return false;
        }
      }
    }

    // Check collision with NPCs
    const npcCollisionRadius = 24;
    for (const char of this.levelData.characters) {
        const dx = char.position.x - x;
        const dy = char.position.y - y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist < npcCollisionRadius) {
            return false;
        }
    }

    return true;
  }

  private getCharacterNear(x: number, y: number, radius: number) {
    let closestChar = null;
    let closestDist = radius;

    for (const char of this.levelData.characters) {
      const dx = char.position.x - x;
      const dy = char.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestChar = char;
      }
    }

    return closestChar;
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
          const bgScale = this.levelData.scalingFactor ?? 1;
          this.actorSprites[char.id].position.set(
            char.position.x * bgScale,
            char.position.y * bgScale,
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
    const bgScale = this.levelData.scalingFactor ?? 1;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const mapWidthInPixels = this.levelData.imageResolution.width;
    const mapHeightInPixels = this.levelData.imageResolution.height;

    const mapWidth = mapWidthInPixels * bgScale;
    const mapHeight = mapHeightInPixels * bgScale;

    // Target camera position (center on player)
    let targetX = screenWidth / 2 - (visualTargetX * bgScale);
    let targetY =
      screenHeight / 2 - (visualTargetY * bgScale);

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

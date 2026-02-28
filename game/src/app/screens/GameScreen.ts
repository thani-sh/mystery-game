import { Container, Graphics, Text } from "pixi.js";
import { LevelData, DialogueTree, Position } from "../../game/data/types";
import { InputSystem } from "../../engine/utils/Input";

const TILE_SIZE = 64;

export class GameScreen extends Container {
  private levelData: LevelData;
  private playerPos: Position;
  private mapContainer: Container;
  private actorsContainer: Container;
  private uiContainer: Container;

  private dialogueBox: Container;
  private dialogueText: Text;
  private choiceTexts: Text[] = [];

  private currentDialogue: DialogueTree | null = null;
  private currentDialogueNodeId: string | null = null;

  private actorSprites: Record<string, Graphics> = {};
  private playerSprite: Graphics;

  private moveTimer: number = 0;
  private input: InputSystem;

  constructor(levelData: LevelData) {
    super();
    this.levelData = levelData;
    this.playerPos = { ...levelData.playerStart };
    this.input = InputSystem.getInstance();

    this.mapContainer = new Container();
    this.actorsContainer = new Container();
    this.uiContainer = new Container();

    this.addChild(this.mapContainer);
    this.addChild(this.actorsContainer);
    this.addChild(this.uiContainer);

    this.playerSprite = new Graphics();
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

    this.initMap();
    this.initActors();
    this.initUI();
  }

  private initMap() {
    for (let y = 0; y < this.levelData.height; y++) {
      for (let x = 0; x < this.levelData.width; x++) {
        const tileType = this.levelData.tiles[y][x];
        const rect = new Graphics();

        if (tileType === 0) {
          rect.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x228b22); // grass
        } else {
          rect.rect(0, 0, TILE_SIZE, TILE_SIZE).fill(0x808080); // road
        }

        rect.position.set(x * TILE_SIZE, y * TILE_SIZE);
        this.mapContainer.addChild(rect);
      }
    }
  }

  private initActors() {
    // Player
    this.playerSprite
      .rect(0, 0, TILE_SIZE * 0.8, TILE_SIZE * 0.8)
      .fill(0x0000ff); // blue square for player
    this.playerSprite.position.set(
      this.playerPos.x * TILE_SIZE + TILE_SIZE * 0.1,
      this.playerPos.y * TILE_SIZE + TILE_SIZE * 0.1,
    );
    this.actorsContainer.addChild(this.playerSprite);

    // NPCs
    for (const char of this.levelData.characters) {
      const sprite = new Graphics();
      sprite.rect(0, 0, TILE_SIZE * 0.8, TILE_SIZE * 0.8).fill(0xff0000); // red square for npc
      sprite.position.set(
        char.position.x * TILE_SIZE + TILE_SIZE * 0.1,
        char.position.y * TILE_SIZE + TILE_SIZE * 0.1,
      );
      this.actorSprites[char.id] = sprite;
      this.actorsContainer.addChild(sprite);
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
    if (this.currentDialogue) {
      this.handleDialogueInput();
      return; // Stop game loop if in dialogue
    }

    this.handleMovement(delta);
  }

  private handleMovement(delta: number) {
    this.moveTimer -= delta;
    if (this.moveTimer > 0) return;

    let dx = 0;
    let dy = 0;

    if (this.input.isKeyDown("ArrowUp") || this.input.isKeyDown("w")) dy = -1;
    else if (this.input.isKeyDown("ArrowDown") || this.input.isKeyDown("s"))
      dy = 1;
    else if (this.input.isKeyDown("ArrowLeft") || this.input.isKeyDown("a"))
      dx = -1;
    else if (this.input.isKeyDown("ArrowRight") || this.input.isKeyDown("d"))
      dx = 1;

    if (dx !== 0 || dy !== 0) {
      const newX = this.playerPos.x + dx;
      const newY = this.playerPos.y + dy;

      if (this.canMoveTo(newX, newY)) {
        this.playerPos.x = newX;
        this.playerPos.y = newY;

        // simple animate
        this.playerSprite.position.set(
          this.playerPos.x * TILE_SIZE + TILE_SIZE * 0.1,
          this.playerPos.y * TILE_SIZE + TILE_SIZE * 0.1,
        );
        this.moveTimer = 10; // ~160ms cooldown at 60fps
      } else {
        // Check interact
        const char = this.getCharacterAt(newX, newY);
        if (char && char.interactable && char.dialogueId) {
          this.startDialogue(char.dialogueId);
          this.moveTimer = 20; // cooldown to prevent instant skip
        }
      }
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
    if (this.levelData.tiles[y][x] === 0) return false; // obstacle

    if (this.getCharacterAt(x, y)) return false;

    return true;
  }

  private getCharacterAt(x: number, y: number) {
    return this.levelData.characters.find(
      (c) => c.position.x === x && c.position.y === y,
    );
  }

  private startDialogue(dialogueId: string) {
    // we need to import dialogue data, since it's a mock let's just use the global
    import("../../game/data/poc-data").then((data) => {
      this.currentDialogue = data.dialogue[dialogueId];
      if (this.currentDialogue) {
        this.currentDialogueNodeId = this.currentDialogue.startNodeId;
        this.dialogueBox.visible = true;
        this.renderDialogueNode();
      }
    });
  }

  private renderDialogueNode() {
    if (!this.currentDialogue || !this.currentDialogueNodeId) return;

    const node = this.currentDialogue.nodes[this.currentDialogueNodeId];
    if (!node) {
      this.endDialogue();
      return;
    }

    // Set speaker name + text
    import("../../game/data/poc-data").then((data) => {
      const speakerName = data.characters[node.speaker]?.name || node.speaker;
      this.dialogueText.text = `${speakerName}: ${node.text}`;

      // Clear old choices
      this.choiceTexts.forEach((t) => t.destroy());
      this.choiceTexts = [];

      // Render new choices
      node.choices.forEach((choice, idx) => {
        const choiceText = new Text({
          text: `${idx + 1}. ${choice.text}`,
          style: { fontSize: 20, fill: 0xaaaaaa },
        });
        choiceText.position.set(40, 80 + idx * 30);
        this.dialogueBox.addChild(choiceText);
        this.choiceTexts.push(choiceText);
      });
    });
  }

  private handleDialogueInput() {
    if (!this.currentDialogue || !this.currentDialogueNodeId) return;
    const node = this.currentDialogue.nodes[this.currentDialogueNodeId];
    if (!node) return;

    for (let i = 0; i < node.choices.length; i++) {
      if (this.input.isKeyDown((i + 1).toString())) {
        const choice = node.choices[i];

        if (choice.action) {
          if (choice.action.type === "move_character") {
            const char = this.levelData.characters.find(
              (c) => c.id === choice.action!.characterId,
            );
            if (char) {
              char.position = { ...choice.action.target };
              // update sprite
              if (this.actorSprites[char.id]) {
                this.actorSprites[char.id].position.set(
                  char.position.x * TILE_SIZE + TILE_SIZE * 0.1,
                  char.position.y * TILE_SIZE + TILE_SIZE * 0.1,
                );
              }
            }
          }
        }

        if (choice.nextNodeId) {
          this.currentDialogueNodeId = choice.nextNodeId;
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

  private endDialogue() {
    this.currentDialogue = null;
    this.currentDialogueNodeId = null;
    this.dialogueBox.visible = false;
  }

  // Handle window resize
  public resize(width: number, height: number) {
    this.dialogueBox.position.set((width - 800) / 2, height - 250);

    // Center map
    const mapWidth = this.levelData.width * TILE_SIZE;
    const mapHeight = this.levelData.height * TILE_SIZE;

    this.mapContainer.position.set(
      (width - mapWidth) / 2,
      (height - mapHeight) / 2,
    );
    this.actorsContainer.position.set(
      (width - mapWidth) / 2,
      (height - mapHeight) / 2,
    );
  }
}

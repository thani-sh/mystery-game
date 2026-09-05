import {
  AnimatedSprite,
  Assets,
  Container,
  Graphics,
  Sprite,
  Text,
} from "pixi.js";
import type { Scene } from "../../engine/types";
import { InputSystem } from "../../engine/utils/Input";
import { resolveActorFrameSheet } from "../../game/data/assetPaths";
import { characters, lookupLevel } from "../../game/data/content";
import type {
  Action,
  CharacterData,
  LevelConfig,
  Position,
} from "../../game/data/types";
import { preloadLevel } from "../../game/systems/AssetLoader";

const TILE_SIZE = 64;

/** Character record entries also carry `displayName` (v2 ActorConfig view). */
type CharacterEntry = CharacterData & { displayName?: string };

/**
 * Schema-v2 level screen: constructed from a level *id*, resolves its
 * LevelConfig through the ContentIndex and drives the player/NPCs from
 * `level.player` + `level.actors`. Asset loading is delegated to
 * preloadLevel (derived from the config) — no hardcoded actor loads.
 *
 * Movement / collision / camera / dialogue / choice / action logic is
 * behaviorally identical to the v1 GameScreen it replaces.
 */
export class LevelScene extends Container implements Scene {
  private level: LevelConfig;
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

  constructor(levelId: string) {
    super();
    const level = lookupLevel(levelId);
    if (!level) {
      throw new Error(`Unknown level: ${levelId}`);
    }
    // The ContentIndex still types level files against the v1 LevelData shape
    // (both key sets exist on disk during the migration), but the screen runs
    // the v2 LevelConfig surface: level.player + level.actors.
    this.level = level as unknown as LevelConfig;
    this.playerPos = { ...this.level.player.start };
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
    // Preload every asset this level needs (background + player/NPC frame
    // sheets). Missing assets warn and continue, never killing the level.
    await preloadLevel(this.level);

    this.initMap();
    this.initActors();
    this.initUI();
  }

  private initMap() {
    const texture = Assets.get(this.level.background);
    const bg = new Sprite(texture);
    const bgScale = this.level.scalingFactor ?? 1;
    // Scale background
    bg.scale.set(bgScale);
    this.mapContainer.addChild(bg);
  }

  private initActors() {
    const bgScale = this.level.scalingFactor ?? 1;
    const playerActorId = this.level.player.actorId;

    // Player
    const playerFrames = Assets.cache.get(
      resolveActorFrameSheet(playerActorId, "idle"),
    ).animations;
    this.playerSprite = new AnimatedSprite(playerFrames.down);
    const playerScale = characters[playerActorId]?.scale ?? 1;
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

    // NPCs — iterate level.actors; the sprite source (frames folder + scale)
    // comes from actor.actorId, the instance bookkeeping key from actor.id.
    for (const actor of this.level.actors) {
      // Set NPCs to look down and face idle by default
      const frames =
        Assets.cache.get(resolveActorFrameSheet(actor.actorId, "idle"))
          ?.animations?.down || []; // Fallback if missing

      // Avoid crash if assets missing
      if (!frames || frames.length === 0) continue;

      const sprite = new AnimatedSprite(frames);
      const actorScale = characters[actor.actorId]?.scale ?? 1;
      sprite.width = TILE_SIZE * actorScale;
      sprite.height = TILE_SIZE * actorScale;
      // Anchor to bottom-center so the character stands on their tile
      sprite.anchor.set(0.5, 1.0);
      sprite.animationSpeed = 0.1;
      sprite.position.set(
        actor.position.x * bgScale,
        actor.position.y * bgScale,
      );
      sprite.zIndex = sprite.y;
      sprite.play();
      this.actorSprites[actor.id] = sprite;
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
    const sheet = Assets.cache.get(resolveActorFrameSheet(actorId, state));
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
          this.level.player.actorId,
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
    const bgScale = this.level.scalingFactor ?? 1;

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
    if (
      (this.input.isKeyDown("e") ||
        this.input.isKeyDown("Enter") ||
        this.input.isKeyDown(" ")) &&
      this.interactCooldown <= 0
    ) {
      const interactRadius = 64; // distance in pixels
      const actor = this.getActorNear(
        this.playerPos.x,
        this.playerPos.y,
        interactRadius,
      );
      if (actor && actor.interactable && actor.dialogueStart) {
        this.startDialogue(actor.dialogueStart);
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
        this.level.player.actorId,
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
          this.level.player.actorId,
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
    const mapWidthInPixels = this.level.imageResolution.width;
    const mapHeightInPixels = this.level.imageResolution.height;

    if (
      px - rx < 0 ||
      px + rx > mapWidthInPixels ||
      py - ry * 2 < 0 ||
      py > mapHeightInPixels
    ) {
      return false;
    }

    if (this.level.collisions) {
      for (const rect of this.level.collisions) {
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
    for (const actor of this.level.actors) {
      const dx = actor.position.x - x;
      const dy = actor.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      if (dist < npcCollisionRadius) {
        return false;
      }
    }

    return true;
  }

  private getActorNear(x: number, y: number, radius: number) {
    let closestActor = null;
    let closestDist = radius;

    for (const actor of this.level.actors) {
      const dx = actor.position.x - x;
      const dy = actor.position.y - y;
      const dist = Math.sqrt(dx * dx + dy * dy);

      if (dist < closestDist) {
        closestDist = dist;
        closestActor = actor;
      }
    }

    return closestActor;
  }

  private startDialogue(dialogueStart: string) {
    if (this.level.dialogues && this.level.dialogues[dialogueStart]) {
      this.currentDialogueNodeId = dialogueStart;
      this.dialogueBox.visible = true;
      this.renderDialogueNode();
    }
  }

  private renderDialogueNode() {
    if (!this.currentDialogueNodeId || !this.level.dialogues) return;

    const node = this.level.dialogues[this.currentDialogueNodeId];
    if (!node) {
      this.endDialogue();
      return;
    }

    // Set speaker name + text — prefer the record's v2 displayName, falling
    // back to the v1 `name`, then to the raw speaker key.
    const speakerInfo = characters[node.speaker] as CharacterEntry | undefined;
    const speakerName =
      speakerInfo?.displayName ?? speakerInfo?.name ?? node.speaker;
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
    if (!this.currentDialogueNodeId || !this.level.dialogues) return;
    const node = this.level.dialogues[this.currentDialogueNodeId];
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

        if (choice.scriptId && this.level.scripts) {
          const script = this.level.scripts[choice.scriptId];
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
      const actor = this.level.actors.find((a) => a.id === action.characterId);
      if (actor) {
        actor.position = { ...action.target };
        // update sprite
        if (this.actorSprites[actor.id]) {
          const bgScale = this.level.scalingFactor ?? 1;
          this.actorSprites[actor.id].position.set(
            actor.position.x * bgScale,
            actor.position.y * bgScale,
          );
          this.actorSprites[actor.id].zIndex = this.actorSprites[actor.id].y;
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
    const bgScale = this.level.scalingFactor ?? 1;
    const screenWidth = window.innerWidth;
    const screenHeight = window.innerHeight;

    const mapWidthInPixels = this.level.imageResolution.width;
    const mapHeightInPixels = this.level.imageResolution.height;

    const mapWidth = mapWidthInPixels * bgScale;
    const mapHeight = mapHeightInPixels * bgScale;

    // Target camera position (center on player)
    let targetX = screenWidth / 2 - visualTargetX * bgScale;
    let targetY = screenHeight / 2 - visualTargetY * bgScale;

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

import {
  Container,
  Assets,
  AnimatedSprite,
  Sprite,
  Texture,
  SCALE_MODES,
} from "pixi.js";
import type { Scene } from "../../engine/types";
import { InputSystem } from "../../engine/utils/Input";
import { resolveActorFrameSheet } from "../../game/data/assetPaths";
import { characters, lookupLevel } from "../../game/data/content";
import type {
  DialogueChoice,
  LevelConfig,
  Position,
} from "../../game/data/types";
import { GameState } from "../../game/state/GameState";
import { runActions } from "../../game/systems/ActionRunner";
import type { WorldHooks } from "../../game/systems/ActionRunner";
import { preloadLevel } from "../../game/systems/AssetLoader";
import { visibleChoices } from "../../game/systems/visibleChoices";
import { evaluateZoneEvents } from "../../game/systems/zones";
import { DialogueBox } from "../ui/DialogueBox";

const TILE_SIZE = 64;

/** Params the SceneManager hands to `init` on a "level" goto. */
interface LevelInitParams {
  levelId?: string;
  spawn?: Position;
}

/**
 * Schema-v2 level screen: constructed from a level *id*, resolves its
 * LevelConfig through the ContentIndex and drives the player/NPCs from
 * `level.player` + `level.actors`. Asset loading is delegated to
 * preloadLevel (derived from the config) — no hardcoded actor loads.
 *
 * Dialogue UI lives in the presentational DialogueBox component; this scene
 * owns the game logic around it: resolving speaker display names, filtering
 * flag-gated choices (visibleChoices), feeding keyboard input to the visible
 * rows, and executing choice actions through the pure ActionRunner against
 * the scene's WorldHooks (actor moves, GameState flags, level navigation).
 *
 * Movement / collision / camera / gameplay are behaviorally identical to the
 * v1 GameScreen this screen replaces.
 */
export class LevelScene extends Container implements Scene {
  private level: LevelConfig;
  private playerPos: Position;
  private mapContainer: Container;
  private actorsContainer: Container;
  private uiContainer: Container;

  /** Shared across level transitions (flags persist when jumping levels). */
  private readonly gameState: GameState;
  private readonly onLoadLevel?: (levelId: string, spawn?: Position) => void;
  private readonly hooks: WorldHooks;

  private dialogue!: DialogueBox;
  private currentDialogueNodeId: string | null = null;
  /** The flag-filtered choices of the node being shown (selection indexes align with the DialogueBox rows). */
  private currentDialogueChoices: DialogueChoice[] = [];

  /**
   * Enter/exit edge tracking for trigger + exit zones. Zone keys (see
   * checkZoneTransitions) are entered ONCE — on the frame they appear in the
   * current overlap but not the previous one — so scripts fire when the
   * player walks INTO a zone, never on every frame spent inside it. Keys
   * leaving the overlap reset membership, so re-entering the same zone (a
   * repeatable trigger, or a consumed exit avoided in time) fires again.
   */
  private prevOverlapZones: Set<string> = new Set();

  private actorSprites: Record<string, AnimatedSprite> = {};
  private playerSprite!: AnimatedSprite;

  private playerDirection: "down" | "up" | "left" | "right" = "down";
  private playerState: "idle" | "walk" = "idle";

  private input: InputSystem;

  // Throttle interactions
  private interactCooldown: number = 0;

  constructor(
    levelId: string,
    opts: {
      gameState?: GameState;
      onLoadLevel?: (levelId: string, spawn?: Position) => void;
    } = {},
  ) {
    super();
    const level = lookupLevel(levelId);
    if (!level) {
      throw new Error(`Unknown level: ${levelId}`);
    }
    // lookupLevel returns the schema-v2 LevelConfig (player + actors); the
    // ContentIndex no longer carries a legacy v1 level shape.
    this.level = level;
    this.playerPos = { ...this.level.player.start };
    this.input = InputSystem.getInstance();

    this.gameState = opts.gameState ?? GameState.create();
    this.onLoadLevel = opts.onLoadLevel;
    this.hooks = {
      moveActor: (actorId, target) => this.moveActor(actorId, target),
      setFlag: (flag) => this.gameState.setFlag(flag),
      clearFlag: (flag) => this.gameState.clearFlag(flag),
      loadLevel: (levelId, spawn) => this.onLoadLevel?.(levelId, spawn),
      message: (text) => console.log("[dialogue message]", text),
    };

    this.mapContainer = new Container();
    this.actorsContainer = new Container();
    this.actorsContainer.sortableChildren = true; // enable Y-sorting
    this.uiContainer = new Container();

    this.addChild(this.mapContainer);
    this.addChild(this.actorsContainer);
    this.addChild(this.uiContainer);

    this.dialogue = new DialogueBox();
  }

  public async init(params?: unknown) {
    // Preload every asset this level needs (background + player/NPC frame
    // sheets). Missing assets warn and continue, never killing the level.
    await preloadLevel(this.level);

    // A goto may carry a spawn point (level exits / load_level actions);
    // default to the level's configured player start otherwise.
    const spawn = (params as LevelInitParams | undefined)?.spawn;
    if (spawn) {
      this.playerPos = { ...spawn };
    }

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
    this.setPixelated(this.playerSprite);
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
      this.setPixelated(sprite);
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

  /**
   * Pixel-art sprites must sample with NEAREST filtering — the default LINEAR
   * bleeds transparent edge texels at fractional screen positions, which shows
   * up as a light fringe/shimmer around characters.
   */
  private setPixelated(sprite: AnimatedSprite) {
    for (const entry of sprite.textures) {
      const tex = entry instanceof Texture ? entry : entry.texture;
      tex.baseTexture.scaleMode = SCALE_MODES.NEAREST;
    }
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
      this.setPixelated(sprite);
      sprite.play();
    }
  }

  private initUI() {
    // The DialogueBox owns the dialogue panel + texts; add it to the UI layer
    // and let resize() keep it bottom-center as the viewport changes.
    this.uiContainer.addChild(this.dialogue);
    this.dialogue.resize(window.innerWidth, window.innerHeight);
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
    // Trigger/exit overlap checks run AFTER movement (against the moved
    // position) and independently of interaction. A dialogue opening this
    // frame pauses the world, so zones are never evaluated mid-dialogue.
    this.checkZoneTransitions();
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

  /**
   * Enter-edge detection for trigger scripts and level exits, run once per
   * frame AFTER movement against the player's current (unscaled map-pixel)
   * position.
   *
   * Membership is recomputed each frame into a fresh set; a zone key fires
   * exactly when it overlaps now but did not overlap on the previous frame —
   * i.e. the player walked INTO it. Keys absent from the current overlap drop
   * out of the remembered set automatically, so leaving and re-entering a
   * repeatable (once:false) trigger fires it again, while `once` triggers are
   * additionally consumed through a GameState flag (survives scene reloads).
   *
   * Exits fire their level transition the same way. The scene is replaced by
   * the goto, but the key is still recorded for the frame so a deferred swap
   * (async init of the next level) cannot double-fire the transition.
   */
  private checkZoneTransitions(): void {
    const { events, exit, nextKeys } = evaluateZoneEvents(
      this.level,
      this.playerPos,
      (flag) => this.gameState.hasFlag(flag),
      this.prevOverlapZones,
    );

    // Fire trigger scripts on zone ENTRY only (enter-edge semantics live in
    // evaluateZoneEvents: events are triggers not present in prevOverlapZones).
    for (const event of events) {
      runActions(event.script, this.hooks);
      if (event.once) {
        this.gameState.setFlag(event.key);
      }
    }

    // Fire the first exit whose zone the player just entered.
    if (
      exit &&
      !this.prevOverlapZones.has(`exit:${this.level.id}:${exit.id}`)
    ) {
      this.onLoadLevel?.(exit.targetLevel, exit.spawn);
    }

    this.prevOverlapZones = nextKeys;
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
      this.renderDialogueNode(); // DialogueBox.show() makes itself visible
    }
  }

  private renderDialogueNode() {
    if (!this.currentDialogueNodeId || !this.level.dialogues) return;

    const node = this.level.dialogues[this.currentDialogueNodeId];
    if (!node) {
      this.endDialogue();
      return;
    }

    // Speaker name — the character record's displayName (ActorConfig), or the
    // raw speaker key when no character record exists.
    const speakerName = characters[node.speaker]?.displayName ?? node.speaker;

    // Filter flag-gated choices through the shared GameState, keep the filtered
    // list on the scene so selection indexes always align with what the player
    // actually sees (never the raw, possibly larger, node.choices).
    const choices = visibleChoices(node.choices, (flag) =>
      this.gameState.hasFlag(flag),
    );
    this.currentDialogueChoices = choices;

    this.dialogue.show(
      speakerName,
      node.text,
      choices.length > 0 ? choices.map((c) => c.text) : null,
    );
  }

  private handleDialogueInput() {
    if (!this.currentDialogueNodeId) return;

    const count = this.dialogue.getChoiceCount();
    for (let i = 0; i < count; i++) {
      if (this.input.isKeyDown((i + 1).toString())) {
        this.selectChoice(this.currentDialogueChoices[i]);
        this.input.clear(); // clear keys so we don't double trigger
        return;
      }
    }
  }

  /**
   * Apply one chosen entry. A plain "Continue" row has no backing
   * DialogueChoice (undefined) and simply ends the dialogue; real choices run
   * their `action` and/or `scriptId` effects (via the pure ActionRunner), then
   * navigate to `next` or end.
   */
  private selectChoice(choice: DialogueChoice | undefined) {
    if (!choice) {
      this.endDialogue();
      return;
    }

    if (choice.action) {
      runActions([choice.action], this.hooks);
    }

    if (choice.scriptId && this.level.scripts) {
      const script = this.level.scripts[choice.scriptId];
      if (script) {
        runActions(script, this.hooks);
      }
    }

    if (choice.next) {
      this.currentDialogueNodeId = choice.next;
      this.renderDialogueNode();
    } else {
      this.endDialogue();
    }
  }

  /**
   * WorldHooks.moveActor implementation — the old inline action executor body:
   * find the actor instance by level id, move its data position and slide the
   * sprite to match (scaling-aware).
   */
  private moveActor(actorId: string, target: Position) {
    const actor = this.level.actors.find((a) => a.id === actorId);
    if (!actor) return;

    actor.position = { ...target };
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

  private endDialogue() {
    this.currentDialogueNodeId = null;
    this.dialogue.clear();
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
    this.dialogue.resize(width, height);
    this.updateCamera();
  }
}

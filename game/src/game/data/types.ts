export interface Position {
  x: number;
  y: number;
}

export interface CharacterData {
  id: string;
  name: string;
  sprite: string;
  scale?: number; // visual size multiplier relative to TILE_SIZE. Default: 1
}

export type Action =
  | { type: "move_character"; characterId: string; target: Position }
  | { type: "move_actor"; actorId: string; target: Position }
  | { type: "set_flag"; flag: string }
  | { type: "clear_flag"; flag: string }
  | { type: "load_level"; levelId: string; spawn?: Position }
  | { type: "message"; text: string };

export interface DialogueChoice {
  text: string;
  next?: string;
  action?: Action;
  scriptId?: string;
}

export interface DialogueNode {
  speaker: string; // Character ID
  text: string;
  choices?: DialogueChoice[];
}

export interface MapCharacter {
  id: string; // references CharacterData.id
  position: Position;
  interactable: boolean;
  dialogueStart?: string; // references root DialogueNode key in dialogues
}

export interface LevelData {
  id: string;
  background: string; // path to the static background image asset
  scalingFactor?: number;
  imageResolution: { width: number; height: number };
  characters: MapCharacter[];
  playerStart: Position;
  dialogues?: Record<string, DialogueNode>;
  scripts?: Record<string, Action[]>;
  collisions?: Rectangle[];
}

export interface Rectangle {
  x: number;
  y: number;
  w: number;
  h: number;
}

// --- Schema v2 (content-driven scaling): additive types below ----------------

export interface ActorConfig {
  id: string; // folder name under public/assets/actors
  displayName: string; // shown in dialogue
  scale?: number; // visual size multiplier relative to TILE_SIZE. Default: 1
}

export interface LevelActor {
  id: string; // instance id (references ActorConfig.id by default)
  actorId: string; // which ActorConfig / sprite to use
  position: Position;
  facing?: "down" | "up" | "left" | "right";
  interactable?: boolean;
  dialogueStart?: string; // key into level.dialogues
  scriptIdOnTalk?: string; // optional script to run when talked to instead of dialogue
}

export interface LevelExit {
  id: string;
  zone: Rectangle; // player overlaps => transition
  targetLevel: string; // LevelConfig.id
  spawn: Position; // position in the target level
}

export interface Trigger {
  id: string;
  zone: Rectangle;
  once?: boolean; // default true
  scriptId: string; // key into level.scripts
}

export interface LevelConfig {
  id: string;
  title?: string;
  background: string; // path to the static background image asset
  imageResolution: { width: number; height: number };
  scalingFactor?: number;
  player: { actorId: string; start: Position }; // was: implicit "bets" + playerStart
  actors: LevelActor[]; // was: characters[]
  dialogues?: Record<string, DialogueNode>; // kept per-level
  scripts?: Record<string, Action[]>;
  triggers?: Trigger[]; // NEW: region + once + scriptId
  exits?: LevelExit[]; // NEW: walk-out-of-level transitions
  collisions?: Rectangle[];
}

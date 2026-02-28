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

export interface Action {
  type: "move_character";
  characterId: string;
  target: Position;
}

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
  width: number;
  height: number;
  // Array of layers, where each layer is a 2D grid. 0 = transparent/empty
  tiles: number[][][];
  characters: MapCharacter[];
  playerStart: Position;
  dialogues?: Record<string, DialogueNode>;
  scripts?: Record<string, Action[]>;
}

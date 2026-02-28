export interface Position {
  x: number;
  y: number;
}

export interface CharacterData {
  id: string;
  name: string;
  sprite: string;
}

export interface DialogueChoice {
  text: string;
  nextNodeId?: string;
  action?: {
    type: "move_character";
    characterId: string;
    target: Position;
  };
}

export interface DialogueNode {
  id: string;
  speaker: string; // Character ID
  text: string;
  choices: DialogueChoice[];
}

export interface DialogueTree {
  id: string;
  startNodeId: string;
  nodes: Record<string, DialogueNode>;
}

export interface MapCharacter {
  id: string; // references CharacterData.id
  position: Position;
  interactable: boolean;
  dialogueId?: string; // references DialogueTree.id
}

export interface LevelData {
  id: string;
  width: number;
  height: number;
  // Simplified grid: 0 = unwalkable, 1 = floor/road
  tiles: number[][];
  characters: MapCharacter[];
  playerStart: Position;
}

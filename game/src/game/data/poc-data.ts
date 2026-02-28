import { CharacterData, DialogueTree, LevelData } from "./types";

export const characters: Record<string, CharacterData> = {
  bets: {
    id: "bets",
    name: "Bets",
    sprite: "bets_sprite",
  },
  goon: {
    id: "goon",
    name: "Mr. Goon",
    sprite: "goon_sprite",
  },
};

export const dialogue: Record<string, DialogueTree> = {
  goon_intro: {
    id: "goon_intro",
    startNodeId: "node_1",
    nodes: {
      node_1: {
        id: "node_1",
        speaker: "goon",
        text: "Clear off! You kids are always causing trouble. What do you want?",
        choices: [
          {
            text: "Sorry Mr. Goon, we were just passing by.",
            nextNodeId: "node_2",
          },
          {
            text: "Have you seen anything suspicious lately?",
            nextNodeId: "node_3",
          },
          {
            text: "Look over there! A distraction!",
            action: {
              type: "move_character",
              characterId: "goon",
              target: { x: 5, y: 5 },
            },
          },
        ],
      },
      node_2: {
        id: "node_2",
        speaker: "goon",
        text: "Well pass by faster! I have police work to do.",
        choices: [
          {
            text: "Goodbye, sir.",
            action: {
              type: "move_character",
              characterId: "goon",
              target: { x: 5, y: 5 },
            },
          },
        ],
      },
      node_3: {
        id: "node_3",
        speaker: "goon",
        text: "Suspicious? Only you kids snooping around. Now be off!",
        choices: [
          {
            text: "We are leaving, sir.",
            action: {
              type: "move_character",
              characterId: "goon",
              target: { x: 5, y: 5 },
            },
          },
        ],
      },
    },
  },
};

// 10x10 grid. 1 = road, 0 = grass/obstacle
const tiles = [
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [1, 1, 1, 1, 1, 1, 1, 1, 1, 1],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
  [0, 0, 0, 0, 1, 1, 0, 0, 0, 0],
];

export const level: LevelData = {
  id: "village_crossroads",
  width: 10,
  height: 10,
  tiles,
  characters: [
    {
      id: "goon",
      position: { x: 5, y: 4 },
      interactable: true,
      dialogueId: "goon_intro",
    },
  ],
  playerStart: { x: 4, y: 8 },
};

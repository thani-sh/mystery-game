// ContentIndex — build-time registry of all game content.
// Globs every characters/*.json and levels/*.json plus game.json so that
// "adding content" means dropping a JSON file in and never touching code.
// Pure data layer: no imports from app/ or engine/.
//
// Mirrors the eager import.meta.glob pattern from app/screens/GameScreen.ts
// (character loading is centralized here; GameScreen.ts is unchanged until
// Phase 3).
import gameConfig from "./game.json";
import type { CharacterData, LevelData } from "./types";

const characterFiles = import.meta.glob("./characters/*.json", {
  eager: true,
});

export const characters: Record<string, CharacterData> = {};
for (const path in characterFiles) {
  const file = characterFiles[path] as Record<string, unknown>;
  const data = (file.default || file) as CharacterData;
  characters[data.id] = data;
}

const levelFiles = import.meta.glob("./levels/*.json", {
  eager: true,
});

export const levels: Record<string, LevelData> = {};
for (const path in levelFiles) {
  const file = levelFiles[path] as Record<string, unknown>;
  const data = (file.default || file) as LevelData;
  levels[data.id] = data;
}

export { gameConfig };

export function lookupCharacter(id: string): CharacterData | undefined {
  return characters[id];
}

export function lookupLevel(id: string): LevelData | undefined {
  return levels[id];
}

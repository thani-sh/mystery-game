// ContentIndex — build-time registry of all game content.
// Globs every characters/*.json and levels/*.json plus game.json so that
// "adding content" means dropping a JSON file in and never touching code.
// Pure data layer: no imports from app/ or engine/.
import gameConfig from "./game.json";
import type { ActorConfig, LevelConfig } from "./types";

const characterFiles = import.meta.glob("./characters/*.json", {
  eager: true,
});

export const characters: Record<string, ActorConfig> = {};
for (const path in characterFiles) {
  const file = characterFiles[path] as Record<string, unknown>;
  const data = (file.default || file) as ActorConfig;
  characters[data.id] = data;
}

const levelFiles = import.meta.glob("./levels/*.json", {
  eager: true,
});

export const levels: Record<string, LevelConfig> = {};
for (const path in levelFiles) {
  const file = levelFiles[path] as Record<string, unknown>;
  const data = (file.default || file) as LevelConfig;
  levels[data.id] = data;
}

export { gameConfig };

export function lookupCharacter(id: string): ActorConfig | undefined {
  return characters[id];
}

export function lookupLevel(id: string): LevelConfig | undefined {
  return levels[id];
}

#!/usr/bin/env node
// validate-content.mjs — dependency-free content validator for
// game/src/game/data (characters/, levels/, game.json).
//
// Report-only for now: prints [OK]/[WARN]/[ERROR] lines and ALWAYS exits 0.
// Phase 3 of the content-driven refactor migrates levels/level1.json to
// schema v2; only then do [ERROR] lines gate the build.
//
// Run from game/:  npm run validate:content
import { existsSync, readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const GAME_ROOT = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
);
const DATA_DIR = path.join(GAME_ROOT, "src", "game", "data");
const CHARACTERS_DIR = path.join(DATA_DIR, "characters");
const LEVELS_DIR = path.join(DATA_DIR, "levels");
const GAME_JSON_PATH = path.join(DATA_DIR, "game.json");
const PUBLIC_ASSETS_DIR = path.join(GAME_ROOT, "public", "assets");

// ---------------------------------------------------------------------------
// Output helpers
// ---------------------------------------------------------------------------

const lines = [];
const counts = { ok: 0, warn: 0, error: 0 };

function emit(kind, message) {
  lines.push(`[${kind}] ${message}`);
  counts[kind.toLowerCase()]++;
}

function ok(message) {
  emit("OK", message);
}

function warn(message) {
  emit("WARN", message);
}

function error(message) {
  emit("ERROR", message);
}

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

const isRecord = (value) =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const hasOwn = (object, key) =>
  isRecord(object) && Object.prototype.hasOwnProperty.call(object, key);

function readJsonFile(label, filePath) {
  try {
    return JSON.parse(readFileSync(filePath, "utf8"));
  } catch (err) {
    error(`${label}: invalid JSON — ${err.message}`);
    return null;
  }
}

function listJsonFiles(dir) {
  try {
    return readdirSync(dir)
      .filter((f) => f.endsWith(".json"))
      .sort();
  } catch (err) {
    error(`cannot read content directory ${dir} — ${err.message}`);
    return [];
  }
}

// Asset path conventions — NOTE: these tiny strings are the JS twins of the
// TS resolvers in src/game/data/assetPaths.ts
// (resolveActorFrameSheet / resolveActorPortrait / resolveLevelBackground).
// They are duplicated here so this validator stays zero-dependency.
const frameSheetFor = (actorId, state) =>
  `/assets/actors/${actorId}/frames/${state}.json`;
const portraitFor = (actorId) => `/assets/actors/${actorId}/speech/talking.png`;
const levelBackgroundFor = (levelId) => `/assets/levels/${levelId}.webp`;

// "/assets/levels/level1.webp" -> public/assets/levels/level1.webp
function publicPathForAssetUrl(assetUrl) {
  return assetUrl.replace(/^\/assets\//, "");
}

function checkAssetExists(label, assetUrl) {
  const rel = publicPathForAssetUrl(assetUrl);
  const abs = path.join(PUBLIC_ASSETS_DIR, rel);
  const display = path.join("public", "assets", rel);
  if (existsSync(abs)) {
    ok(`${label} — asset exists: ${display}`);
  } else {
    warn(`${label} — asset missing: ${display} (referenced as "${assetUrl}")`);
  }
}

// Rectangle is { x, y, w, h }; imageResolution is { width, height }.
function rectWithinImageBounds(rect, imageResolution) {
  if (
    !isRecord(rect) ||
    !isRecord(imageResolution) ||
    !Number.isFinite(imageResolution.width) ||
    !Number.isFinite(imageResolution.height)
  ) {
    return false;
  }
  const { x, y, w, h } = rect;
  return (
    Number.isFinite(x) &&
    Number.isFinite(y) &&
    Number.isFinite(w) &&
    Number.isFinite(h) &&
    x >= 0 &&
    y >= 0 &&
    w > 0 &&
    h > 0 &&
    x + w <= imageResolution.width &&
    y + h <= imageResolution.height
  );
}

function checkRect(label, rectName, rect, imageResolution) {
  if (rectWithinImageBounds(rect, imageResolution)) {
    ok(`${label} — ${rectName} rectangle within imageResolution bounds`);
  } else {
    const rectSummary = isRecord(rect)
      ? JSON.stringify({ x: rect.x, y: rect.y, w: rect.w, h: rect.h })
      : JSON.stringify(rect);
    const imgSummary = isRecord(imageResolution)
      ? `${imageResolution.width}x${imageResolution.height}`
      : "missing imageResolution";
    error(
      `${label} — ${rectName} rectangle outside imageResolution bounds: ` +
        `${rectSummary} vs ${imgSummary}`,
    );
  }
}

// ---------------------------------------------------------------------------
// 1) characters/*.json
// ---------------------------------------------------------------------------

const characterIds = new Set(); // id -> filename, first file wins
const characterIdFile = new Map();

for (const file of listJsonFiles(CHARACTERS_DIR)) {
  const label = `characters/${file}`;
  const data = readJsonFile(label, path.join(CHARACTERS_DIR, file));
  if (data === null) {
    continue;
  }

  // Check (a): duplicate ids within the characters directory.
  const id = isRecord(data) ? data.id : undefined;
  if (typeof id === "string" && id.length > 0) {
    if (characterIds.has(id)) {
      error(
        `${label} — duplicate character id "${id}" ` +
          `(already defined by ${characterIdFile.get(id)})`,
      );
    } else {
      characterIds.add(id);
      characterIdFile.set(id, label);
    }
  }

  // Check (e): required fields id + name.
  const missing = [];
  if (typeof id !== "string" || id.length === 0) {
    missing.push("id");
  }
  if (typeof data.name !== "string" || data.name.length === 0) {
    missing.push("name");
  }
  if (missing.length > 0) {
    error(`${label} — missing required field(s): ${missing.join(", ")}`);
    continue;
  }
  ok(`${label} — parses; required fields id + name present (id "${id}")`);

  // Check (d): v1 sprite field is a texture alias, not a file path — log only.
  if (typeof data.sprite === "string" && data.sprite.length > 0) {
    ok(`${label} — v1 sprite field "${data.sprite}" logged (not a path; ` +
      `actor assets below follow the id-based convention)`);
  }

  // Check (d): actor assets exist by convention (frames + portrait).
  for (const state of ["idle", "walk"]) {
    checkAssetExists(label, frameSheetFor(id, state));
  }
  checkAssetExists(label, portraitFor(id));
}

// ---------------------------------------------------------------------------
// 2) levels/*.json
// ---------------------------------------------------------------------------

const levelIds = new Set(); // id -> filename, first file wins
const levelIdFile = new Map();

for (const file of listJsonFiles(LEVELS_DIR)) {
  const label = `levels/${file}`;
  const data = readJsonFile(label, path.join(LEVELS_DIR, file));
  if (data === null) {
    continue;
  }

  // Check (a): duplicate ids within the levels directory.
  const id = isRecord(data) ? data.id : undefined;
  if (typeof id === "string" && id.length > 0) {
    if (levelIds.has(id)) {
      error(
        `${label} — duplicate level id "${id}" ` +
          `(already defined by ${levelIdFile.get(id)})`,
      );
    } else {
      levelIds.add(id);
      levelIdFile.set(id, label);
    }
  }
  if (typeof id !== "string" || id.length === 0) {
    error(`${label} — missing required field "id"`);
    continue;
  }
  ok(`${label} — parses; level id "${id}"`);

  // Schema detection: v2 = LevelConfig (player + actors); v1 = legacy
  // LevelData shape (characters + playerStart).
  const isV2 = isRecord(data.player) && Array.isArray(data.actors);
  const isV1 =
    !isV2 && Array.isArray(data.characters) && hasOwn(data, "playerStart");

  if (isV1) {
    // Check (c): v1 schema — report as migration pending; never fail.
    warn(
      `${label} — v1 schema (characters + playerStart): ` +
        "migration pending (Phase 3)",
    );
    for (const character of data.characters) {
      const refId = isRecord(character) ? character.id : undefined;
      if (typeof refId !== "string" || refId.length === 0) {
        error(`${label} — v1 characters[] entry missing "id"`);
        continue;
      }
      if (characterIds.has(refId)) {
        ok(
          `${label} — referenced character "${refId}" resolves to ` +
            `characters/${refId}.json`,
        );
      } else {
        warn(
          `${label} — references character "${refId}" but no ` +
            `characters/${refId}.json exists`,
        );
      }
    }
  } else if (isV2) {
    // Check (b): schema v2 cross-references + bounds.
    const imageResolution = data.imageResolution;
    if (!isRecord(imageResolution)) {
      error(`${label} — v2 level missing imageResolution {width, height}`);
    }

    for (const actor of data.actors) {
      if (!isRecord(actor)) {
        error(`${label} — actors[] contains a non-object entry`);
        continue;
      }
      const actorInstanceId = actor.id;
      const actorConfigId = actor.actorId;
      if (!characterIds.has(actorConfigId)) {
        error(
          `${label} — actors[].actorId "${actorConfigId}" ` +
            `(instance "${actorInstanceId}") has no characters/` +
            `${actorConfigId}.json`,
        );
      } else {
        ok(
          `${label} — actor "${actorInstanceId}" actorId "${actorConfigId}" ` +
            "resolves to characters/",
        );
      }
      if (typeof actor.dialogueStart === "string") {
        if (hasOwn(data.dialogues, actor.dialogueStart)) {
          ok(
            `${label} — actor "${actorInstanceId}" dialogueStart ` +
              `"${actor.dialogueStart}" resolves in dialogues`,
          );
        } else {
          error(
            `${label} — actor "${actorInstanceId}" dialogueStart ` +
              `"${actor.dialogueStart}" does not resolve in dialogues`,
          );
        }
      }
      if (typeof actor.scriptIdOnTalk === "string") {
        if (hasOwn(data.scripts, actor.scriptIdOnTalk)) {
          ok(
            `${label} — actor "${actorInstanceId}" scriptIdOnTalk ` +
              `"${actor.scriptIdOnTalk}" resolves in scripts`,
          );
        } else {
          error(
            `${label} — actor "${actorInstanceId}" scriptIdOnTalk ` +
              `"${actor.scriptIdOnTalk}" does not resolve in scripts`,
          );
        }
      }
    }

    // Dialogue-internal references: choices may jump (next) or run a script.
    if (isRecord(data.dialogues)) {
      for (const nodeKey of Object.keys(data.dialogues)) {
        const node = data.dialogues[nodeKey];
        if (!isRecord(node) || !Array.isArray(node.choices)) {
          continue;
        }
        for (const [index, choice] of node.choices.entries()) {
          if (!isRecord(choice)) {
            error(`${label} — dialogue "${nodeKey}" choice ${index} not an object`);
            continue;
          }
          if (typeof choice.next === "string" && !hasOwn(data.dialogues, choice.next)) {
            error(
              `${label} — dialogue "${nodeKey}" choice ${index} next ` +
                `"${choice.next}" does not resolve in dialogues`,
            );
          }
          if (typeof choice.scriptId === "string" && !hasOwn(data.scripts, choice.scriptId)) {
            error(
              `${label} — dialogue "${nodeKey}" choice ${index} scriptId ` +
                `"${choice.scriptId}" does not resolve in scripts`,
            );
          }
        }
      }
    }

    // Triggers: scriptId must resolve; zone within bounds.
    if (Array.isArray(data.triggers)) {
      for (const [index, trigger] of data.triggers.entries()) {
        if (!isRecord(trigger)) {
          error(`${label} — triggers[${index}] not an object`);
          continue;
        }
        const triggerId = trigger.id ?? index;
        if (!hasOwn(data.scripts, trigger.scriptId)) {
          error(
            `${label} — trigger "${triggerId}" scriptId ` +
              `"${trigger.scriptId}" does not resolve in scripts`,
          );
        }
        checkRect(label, `trigger "${triggerId}" zone`, trigger.zone, imageResolution);
      }
    }

    // Exits: targetLevel must resolve to a scanned level id; zone within bounds.
    if (Array.isArray(data.exits)) {
      for (const [index, exit] of data.exits.entries()) {
        if (!isRecord(exit)) {
          error(`${label} — exits[${index}] not an object`);
          continue;
        }
        const exitId = exit.id ?? index;
        if (typeof exit.targetLevel !== "string") {
          error(`${label} — exit "${exitId}" missing targetLevel`);
        } else if (!levelIds.has(exit.targetLevel)) {
          error(
            `${label} — exit "${exitId}" targetLevel "${exit.targetLevel}" ` +
              "does not resolve to any scanned level",
          );
        } else {
          ok(
            `${label} — exit "${exitId}" targetLevel "${exit.targetLevel}" ` +
              "resolves to a scanned level",
          );
        }
        checkRect(label, `exit "${exitId}" zone`, exit.zone, imageResolution);
      }
    }

    // Collisions within imageResolution bounds.
    if (Array.isArray(data.collisions)) {
      for (const [index, rect] of data.collisions.entries()) {
        checkRect(label, `collisions[${index}]`, rect, imageResolution);
      }
    }
  } else {
    warn(
      `${label} — unrecognized level schema (expected v2 "player"+"actors" ` +
        "or v1 \"characters\"+\"playerStart\")",
    );
  }

  // Check (d): referenced background asset exists.
  if (typeof data.background === "string") {
    if (data.background.startsWith("/assets/")) {
      checkAssetExists(label, data.background);
    } else {
      warn(
        `${label} — background "${data.background}" does not start with ` +
          `/assets/ (convention: "${levelBackgroundFor(id)}")`,
      );
    }
  } else {
    error(`${label} — missing background path`);
  }
}

// ---------------------------------------------------------------------------
// 3) game.json boot config
// ---------------------------------------------------------------------------

const gameConfig = readJsonFile("game.json", GAME_JSON_PATH);
if (gameConfig !== null) {
  if (isRecord(gameConfig)) {
    const required = ["startScene", "startLevel", "defaultPlayerActorId"];
    const missing = required.filter((key) => typeof gameConfig[key] !== "string");
    if (missing.length > 0) {
      error(`game.json — missing required string field(s): ${missing.join(", ")}`);
    } else {
      ok(
        "game.json — parses; boot config fields present " +
          `(startScene "${gameConfig.startScene}", startLevel ` +
          `"${gameConfig.startLevel}", defaultPlayerActorId ` +
          `"${gameConfig.defaultPlayerActorId}")`,
      );
      if (levelIds.has(gameConfig.startLevel)) {
        ok(`game.json — startLevel "${gameConfig.startLevel}" resolves to a scanned level`);
      } else {
        warn(
          `game.json — startLevel "${gameConfig.startLevel}" does not resolve ` +
            "to any scanned level",
        );
      }
    }
  } else {
    error("game.json — expected a JSON object");
  }
}

// ---------------------------------------------------------------------------
// Summary — always exit 0 (report-only until Phase 3 migration)
// ---------------------------------------------------------------------------

lines.push("");
lines.push(
  `summary: ${counts.ok} [OK], ${counts.warn} [WARN], ${counts.error} [ERROR] ` +
    "(report-only — exiting 0; Phase 3 will gate the build on 0 [ERROR]s)",
);
console.log(lines.join("\n"));
process.exit(0);

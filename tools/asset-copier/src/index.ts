#!/usr/bin/env bun
import { resolve, join, dirname, relative } from "path";
import { mkdir, stat } from "fs/promises";
import sharp from "sharp";

// Paths relative to the project root
const ASSETS_DIR = resolve(import.meta.dir, "../../../assets");
const TARGET_DIR = resolve(import.meta.dir, "../../../game/public/assets");

import { writeFile } from "fs/promises";

interface ProcessOptions {
  removeBackground: boolean;
  sourcePath: string;
  targetPath: string;
}

/**
 * Generate a JSON sprite definition for 16x16 tilesets
 * Assumes a 16x16 grid (256 frames) with dimensions 1024x1024 and 64x64 frames
 */
async function generateTilesetJson(
  imagePath: string,
  targetJsonPath: string,
): Promise<void> {
  const imageName = relative(dirname(imagePath), imagePath);

  // Standard 16x16 grid layout for tiles
  const spriteDef = {
    frames: {} as Record<string, any>,
    meta: {
      image: imageName,
      format: "RGBA8888",
      size: { w: 1024, h: 1024 },
      scale: "1",
    },
  };

  // Generate the 256 tiles
  for (let i = 0; i < 256; i++) {
    const col = i % 16;
    const row = Math.floor(i / 16);
    const x = col * 64;
    const y = row * 64;

    spriteDef.frames[`tile_${i}`] = {
      frame: { x, y, w: 64, h: 64 },
      sourceSize: { w: 64, h: 64 },
      spriteSourceSize: { x: 0, y: 0, w: 64, h: 64 },
    };
  }

  await writeFile(targetJsonPath, JSON.stringify(spriteDef, null, 2), "utf8");
}

/**
 * Generate a JSON sprite definition for character frames
 * Assumes a 4x4 grid (16 frames) with dimensions 1024x1024 and 256x256 frames
 */
async function generateSpriteJson(
  imagePath: string,
  targetJsonPath: string,
): Promise<void> {
  const imageName = relative(dirname(imagePath), imagePath);

  // Standard 4x4 grid layout for walk/idle animations
  const spriteDef = {
    frames: {} as Record<string, any>,
    animations: {
      down: ["frame_0", "frame_1", "frame_2", "frame_3"],
      left: ["frame_4", "frame_5", "frame_6", "frame_7"],
      right: ["frame_8", "frame_9", "frame_10", "frame_11"],
      up: ["frame_12", "frame_13", "frame_14", "frame_15"],
    },
    meta: {
      image: imageName,
      format: "RGBA8888",
      size: { w: 1024, h: 1024 },
      scale: "1",
    },
  };

  // Generate the 16 frames
  for (let i = 0; i < 16; i++) {
    const col = i % 4;
    const row = Math.floor(i / 4);
    const x = col * 256;
    const y = row * 256;

    spriteDef.frames[`frame_${i}`] = {
      frame: { x, y, w: 256, h: 256 },
      sourceSize: { w: 256, h: 256 },
      spriteSourceSize: { x: 0, y: 0, w: 256, h: 256 },
    };
  }

  await writeFile(targetJsonPath, JSON.stringify(spriteDef, null, 2), "utf8");
}

/**
 * Remove white background from image buffer
 */
async function removeBackgroundFromBuffer(
  pixelArray: Uint8Array,
  channels: number,
): Promise<Uint8Array> {
  // Process each pixel
  for (let i = 0; i < pixelArray.length; i += channels) {
    const r = pixelArray[i];
    const g = pixelArray[i + 1];
    const b = pixelArray[i + 2];

    // Calculate brightness and color uniformity
    const brightness = (r + g + b) / 3;
    const uniformity = Math.max(r, g, b) - Math.min(r, g, b);

    // If pixel is bright and uniform (near white/gray), make it transparent
    if (brightness > 200 && uniformity < 30) {
      pixelArray[i + 3] = 0; // Set alpha to 0
    }
  }
  return pixelArray;
}

/**
 * Remove background from an image using alpha channel detection
 * This works by making near-white/transparent pixels fully transparent
 */
async function removeBackground(
  inputPath: string,
  outputPath: string,
): Promise<void> {
  try {
    const image = sharp(inputPath);
    const metadata = await image.metadata();

    // If the image already has an alpha channel, enhance transparency
    // Otherwise, create alpha channel based on color similarity to white
    if (metadata.hasAlpha) {
      // Enhance existing transparency
      await image
        .ensureAlpha()
        .normalise()
        .png({ compressionLevel: 9, effort: 10 })
        .toFile(outputPath);
    } else {
      // Create transparency for near-white pixels
      // This uses a threshold approach: pixels close to white become transparent
      const buffer = await image
        .ensureAlpha()
        .raw()
        .toBuffer({ resolveWithObject: true });

      const { data, info } = buffer;
      const pixelArray = new Uint8Array(data);

      const processedPixels = await removeBackgroundFromBuffer(
        pixelArray,
        info.channels,
      );

      // Save processed image
      await sharp(processedPixels, {
        raw: {
          width: info.width,
          height: info.height,
          channels: info.channels as 3 | 4,
        },
      })
        .png({ compressionLevel: 9, effort: 10 })
        .toFile(outputPath);
    }
  } catch (error) {
    console.error(`Error removing background from ${inputPath}:`, error);
    throw error;
  }
}

/**
 * Process a single asset file
 */
async function processAsset(options: ProcessOptions): Promise<void> {
  const { sourcePath, targetPath, removeBackground: shouldRemoveBg } = options;

  // Ensure target directory exists
  await mkdir(dirname(targetPath), { recursive: true });

  if (shouldRemoveBg) {
    console.log(
      `  📸 Processing with background removal and optimization: ${relative(ASSETS_DIR, sourcePath)}`,
    );
    await removeBackground(sourcePath, targetPath);
  } else if (sourcePath.toLowerCase().endsWith(".png")) {
    console.log(`  🗜️ Optimizing PNG: ${relative(ASSETS_DIR, sourcePath)}`);
    await sharp(sourcePath)
      .png({ compressionLevel: 9, effort: 10 })
      .toFile(targetPath);
  } else {
    console.log(`  📋 Copying as-is: ${relative(ASSETS_DIR, sourcePath)}`);
    await Bun.write(targetPath, Bun.file(sourcePath));
  }

  // Generate sprite JSON for images in the frames directory
  if (sourcePath.includes("/frames/")) {
    const targetJsonPath = targetPath.replace(/\.(png|jpg|jpeg|webp)$/i, ".json");
    console.log(`  📝 Generating character sprite JSON: ${relative(ASSETS_DIR, targetJsonPath)}`);
    await generateSpriteJson(targetPath, targetJsonPath);
  } else if (sourcePath.includes("/tilesets/")) {
    const targetJsonPath = targetPath.replace(/\.(png|jpg|jpeg|webp)$/i, ".json");
    console.log(`  📝 Generating tileset JSON: ${relative(ASSETS_DIR, targetJsonPath)}`);
    await generateTilesetJson(targetPath, targetJsonPath);
  }
}

/**
 * Determine if a file should have its background removed
 */
function shouldRemoveBackgroundForFile(relativePath: string): boolean {
  // Remove background for:
  // - Character frames (idle.png, walk.png, etc. in actors/*/frames/)
  // - Character portraits (talking.png in actors/*/speech/)
  // - Tilesets (tileset.png in tilesets/*/)
  // Keep as-is for:
  // - Concept art (concept.png, main-cast-concept-image.jpeg, etc.)

  const lowerPath = relativePath.toLowerCase();

  // Check if it's in frames, speech or tilesets directory
  if (lowerPath.includes("/frames/") || lowerPath.includes("/speech/") || lowerPath.includes("/tilesets/")) {
    return true;
  }

  // Keep concept art as-is
  if (lowerPath.includes("concept")) {
    return false;
  }

  return false;
}

/**
 * Recursively scan and process all assets
 */
async function processDirectory(
  sourceDir: string,
  targetDir: string,
): Promise<void> {
  const entries = await Array.fromAsync(
    new Bun.Glob("**/*").scan({ cwd: sourceDir, onlyFiles: false }),
  );

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry);
    const targetPath = join(targetDir, entry);

    // Check if it's a file
    const file = Bun.file(sourcePath);
    const exists = await file.exists();

    if (!exists) {
      // It's a directory, ensure it exists in target
      await mkdir(targetPath, { recursive: true });
      continue;
    }

    // Check if it's an image file
    const imageExtensions = [".png", ".jpg", ".jpeg", ".webp"];
    const isImage = imageExtensions.some((ext) =>
      entry.toLowerCase().endsWith(ext),
    );

    if (!isImage) {
      console.log(`  ⏭️  Skipping non-image: ${entry}`);
      continue;
    }

    // Process the image
    await processAsset({
      sourcePath,
      targetPath,
      removeBackground: shouldRemoveBackgroundForFile(entry),
    });
  }
}

/**
 * Main CLI function
 */
async function main() {
  console.log("🎨 Asset Copier Tool\n");
  console.log(`📁 Source: ${ASSETS_DIR}`);
  console.log(`📁 Target: ${TARGET_DIR}\n`);

  try {
    // Check if source directory exists
    try {
      const sourceStat = await stat(ASSETS_DIR);
      if (!sourceStat.isDirectory()) {
        console.error(`❌ Source path is not a directory: ${ASSETS_DIR}`);
        process.exit(1);
      }
    } catch (error) {
      console.error(`❌ Source directory not found: ${ASSETS_DIR}`);
      process.exit(1);
    }

    // Create target directory if it doesn't exist
    await mkdir(TARGET_DIR, { recursive: true });

    // Process all assets
    console.log("🔄 Processing assets...\n");
    await processDirectory(ASSETS_DIR, TARGET_DIR);

    console.log("\n✅ Asset preparation complete!");
  } catch (error) {
    console.error("\n❌ Error preparing assets:", error);
    process.exit(1);
  }
}

// Run the CLI
main();

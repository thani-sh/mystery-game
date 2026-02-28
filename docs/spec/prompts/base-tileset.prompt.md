# Tileset Guidelines

These guidelines apply to all 2D game environment tileset generation.

## Composition

- No background. The tileset will be placed on a tilemap.
- Use 1:1 aspect ratio for the image dimensions and use the full canvas.
- Consistent stylized design so that every tile looks like it belongs to the same environment and game.
- Limited but harmonious color palette with strong contrast between objects and white background.

## Design Approach

- Top-down perspective or slight 3/4 top-down angle, typical of retro JRPG games.
- Ensure colors match the character designs.
- Ensure the objects have clean outlines.

## Format Rules

**CRITICAL: Generate a perfectly aligned equally sized 16x16 grid tileset, with exactly 256 tiles**

- Create a square image with exactly 256 equal-sized squares (16x16) completely filling the canvas.
- **ABSOLUTELY NO GAPS, borders, spacing, dividing lines, or margins** between any of the tiles. They must directly touch each other edge-to-edge.
- Each square represents a specific game tile (e.g., grass variations, road parts, walls, props).
- Ensure tiles that are meant to connect (like roads, walls) line up perfectly from one tile's edge to another.
- Do not repeat the same tile or set of tiles. Each tile should be unique but variations are allowed.
- Fill in grid lines to make the tiles seamless.

## Negative Prompts

Avoid foreshortening and realistic blur in tiles. Do not generate a single large environment painting, do not ignore the grid, and ensure exactly a 16x16 grid is present. Avoid making the perspective isometric. Avoid props, only focus on base level tiles. Do not include any gaps, borders, dividing lines, or empty space between tiles.

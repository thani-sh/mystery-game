# Spritesheet Guidelines

These guidelines apply to all character spritesheet generation.

## Composition

- Pure white background (#ffffff) for the entire image.
- No environmental elements, props, or scene details - only the character.
- Use 1:1 aspect ratio for the image dimensions and use the full canvas.
- Position the character sprite at the bottom center of the image.
- Simple, readable sprites with clear silhouettes optimized for 16-bit era aesthetics
- Clean, bold character shapes with easily distinguishable features (hair, clothing, accessories)
- Expressive poses and movement that read clearly even at small sprite sizes
- Consistent stylized design so that every sprite looks like it belongs to the same character and game
- Limited but harmonious color palette with strong contrast between character and white background

## Spritesheet Consistency (CRITICAL)

**When an idle spritesheet reference is provided, treat the generation as an EDIT operation, not creating from scratch:**

- The idle spritesheet serves as the DEFINITIVE reference for the character's appearance, proportions, style, and color palette
- Preserve EXACT character design from the idle spritesheet: same face shape, eye style, hair design, clothing details, body proportions, and color values
- Match the exact art style, line weight, shading approach, and level of detail from the idle reference
- Only animate the character's pose and movement - DO NOT alter any visual characteristics
- The character in every animation must look identical to the idle version, just in different poses
- Think of this as keyframing: the idle spritesheet shows what the character looks like, and you're just adding motion
- Maintain consistent sprite dimensions and positioning across all animations so they can be swapped seamlessly in-game

**Without an idle reference, establish a new baseline that will be used for future animations**

## Format Rules

**CRITICAL: Generate a 4x4 grid spritesheet with 4 animations, one per row**

- Create a square image divided into a 4x4 grid (16 equal squares)
- Each spritesheet contains one animation of the character.
- Each row is dedicated to a cardinal direction in this exact order from top to bottom: Row 1 (Top) = Down, Row 2 = Left, Row 3 = Right, Row 4 (Bottom) = Up. !!!IMPORTANT: DO NOT CHANGE THE ORDER OF THE ROWS!!!
- All 4 frames should show subtle variations in the pose to create smooth animation when cycled
- Animation frames start from the left to right in each row.
- Each square contains one animation frame of the character.
- within each square should have the character on the same y axis position so that the character does not appear to jump up and down between frames.
- Frames must be evenly spaced in the 4x4 grid with clear separation

## Negative Prompts

Avoid inconsistent character designs, equipment, clothing, foreshortening, and motion blur. Do not generate a single frame, multiple characters in one frame, varying character sizes, or varying positions within frames. The grid layout must have exactly 16 frames.

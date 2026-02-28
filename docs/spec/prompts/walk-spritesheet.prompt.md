# Walk Animation Spritesheet

Generate a spritesheet for the character's walking animation.

## Specifics

- **Action**: Walking forward in a complete looping cycle.
- **Animation Details**: You must strictly follow this exact 4-frame sequence:

  **For Rows 1 & 4 (Front & Back Views - Walking Up/Down):**
  1. **Frame 1 (Contact)**: Both feet on ground, right foot slightly forward. Arms neutral or swinging slightly.
  2. **Frame 2 (Passing)**: Right foot firmly planted, left leg bent and lifting up to step forward.
  3. **Frame 3 (Contact)**: Both feet on ground, left foot slightly forward.
  4. **Frame 4 (Passing)**: Left foot firmly planted, right leg bent and lifting up to step forward.

  **For Rows 2 & 3 (Side Profiles - Walking Left/Right):**
  1. **Frame 1 (Contact)**: Legs are spread out like an open scissor, both feet touching the ground. One arm swings forward, one backward.
  2. **Frame 2 (Passing)**: Legs overlap completely vertically. The leg closest to the camera is straight; the leg furthest from the camera is slightly bent. Arms rest at the sides.
  3. **Frame 3 (Contact)**: Legs are spread out like an open scissor. Both feet touching the ground.
  4. **Frame 4 (Passing)**: Legs overlap completely vertically. The leg furthest from the camera is straight; the leg closest to the camera is bent.

- **Wireframe Reference Handling**: A wireframe image is provided ONLY as a structural reference for the 4-frame animation poses.
  - DO NOT include any text, labels, instructions, or titles in the generated image.
  - DO NOT copy the layout, grid density, or whitespace sizing of the wireframe.
  - You MUST use the full canvas exclusively for the generated character's 4x4 grid.

- **Reference**: Follow all "Spritesheets" guidelines from the system prompt. Use the idle spritesheet as a strict reference to maintain consistent character style, proportions, and visual appearance across all 4 frames. The character design must not change, only the pose.

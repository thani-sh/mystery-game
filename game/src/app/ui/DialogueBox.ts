// Presentational dialogue box: the bottom-center "speaker + text + choices"
// panel extracted from LevelScene. It owns only rendering and structure —
// no game logic, no InputSystem, no content lookups. The scene decides what
// to show (it resolves speaker names, filters flag-gated choices, and maps
// keyboard input), this box just draws it.
import { Container, Graphics, Sprite, Text, Texture } from "pixi.js";

// --- Visual geometry (mirrors the legacy inline panel in LevelScene) --------
const PANEL_WIDTH = 800;
const PANEL_HEIGHT = 200;
const PANEL_FILL = 0x000000;
const PANEL_ALPHA = 0.8;
// Gap between the viewport bottom edge and the panel bottom. Legacy scene put
// the 200px panel at `viewportHeight - 250`, i.e. 50px above the bottom.
const BOTTOM_GAP = 50;

// Text rows (x starts at TEXT_X; a portrait slot reserves the far left).
const TEXT_X = 20;
const SPEAKER_Y = 16;
const BODY_Y = 52;
const CHOICES_TOP = 108;
const CHOICE_LINE_HEIGHT = 30;
const CHOICE_X_INDENT = 20; // choices nest slightly right of the body text
const RIGHT_MARGIN = 20;

// Optional portrait slot (used once dialogue content has portraits).
const PORTRAIT_X = 12;
const PORTRAIT_MAX_WIDTH = 160;
const PORTRAIT_MAX_HEIGHT = 190;
const PORTRAIT_GAP = 24; // space kept free between the slot and the text block

const FONT_SPEAKER = 22;
const FONT_BODY = 20;
const FONT_CHOICE = 20;

/** Label shown when a node exposes no pickable choice. */
const CONTINUE_LABEL = "Continue";

/**
 * A dumb dialogue panel:
 *
 *   ┌────────────────────────────────────────────┐
 *   │ Daisy                        [portrait]    │  speaker (bold, white)
 *   │ Hello there, traveller...                  │  body (word-wrapped, white)
 *   │   1. Ask about the farm                    │  choices (numbered, gray)
 *   │   2. Say goodbye                           │
 *   └────────────────────────────────────────────┘
 *
 * `show(...)` renders a node and makes the container visible; `clear()` hides
 * it. Choice rows are rebuilt on every `show` via `setChoices`, and
 * `getChoiceCount()` tells callers how many rows exist (their keyboard 1..N
 * map). The container starts hidden and stays hidden until `show()`.
 */
export class DialogueBox extends Container {
  private readonly panel: Graphics;
  private readonly speakerText: Text;
  private readonly bodyText: Text;
  private readonly portrait: Sprite;
  private choiceTexts: Text[] = [];

  constructor() {
    super();

    this.panel = new Graphics()
      .rect(0, 0, PANEL_WIDTH, PANEL_HEIGHT)
      .fill({ color: PANEL_FILL, alpha: PANEL_ALPHA });
    this.addChild(this.panel);

    // Optional portrait, far-left. Kept invisible until setPortrait().
    this.portrait = new Sprite(Texture.EMPTY);
    this.portrait.visible = false;
    this.addChild(this.portrait);

    this.speakerText = new Text({
      text: "",
      style: {
        fontSize: FONT_SPEAKER,
        fontWeight: "bold",
        fill: 0xffffff,
      },
    });
    this.addChild(this.speakerText);

    this.bodyText = new Text({
      text: "",
      style: {
        fontSize: FONT_BODY,
        fill: 0xffffff,
        wordWrap: true,
        wordWrapWidth: this.bodyWrapWidth(TEXT_X),
      },
    });
    this.addChild(this.bodyText);

    // The box is invisible until show() is called.
    this.visible = false;

    // Default 800x600 viewport assumption keeps the pre-first-resize position
    // identical to the legacy inline placement ("assuming 800x600 for now").
    this.resize(800, 600);
  }

  /**
   * Render one dialogue node. `choices === null` (or empty) shows a single
   * "Continue" row so the player always has a way forward.
   */
  public show(
    speakerName: string,
    text: string,
    choices: string[] | null,
  ): void {
    this.speakerText.text = speakerName;
    this.bodyText.text = text;
    this.setChoices(choices);
    this.visible = true;
  }

  /** Rebuild the pickable choice rows (`null`/empty → single "Continue"). */
  public setChoices(choices: string[] | null): void {
    for (const row of this.choiceTexts) {
      this.removeChild(row);
      row.destroy();
    }
    this.choiceTexts = [];

    const rows = choices && choices.length > 0 ? choices : [CONTINUE_LABEL];
    rows.forEach((entry, idx) => {
      const row = new Text({
        text: `${idx + 1}. ${entry}`,
        style: { fontSize: FONT_CHOICE, fill: 0xaaaaaa },
      });
      this.addChild(row);
      this.choiceTexts.push(row);
    });

    this.layoutRows();
  }

  /** Show (`Texture`) or hide (`null`) the left-hand portrait. */
  public setPortrait(texture: Texture | null): void {
    if (!texture) {
      this.portrait.visible = false;
    } else {
      this.portrait.texture = texture;
      const tw = texture.width;
      const th = texture.height;
      if (tw > 0 && th > 0) {
        const scale = Math.min(
          PORTRAIT_MAX_WIDTH / tw,
          PORTRAIT_MAX_HEIGHT / th,
          1,
        );
        this.portrait.scale.set(scale);
        this.portrait.position.set(
          PORTRAIT_X,
          Math.round((PANEL_HEIGHT - th * scale) / 2),
        );
      }
      this.portrait.visible = true;
    }
    this.layoutRows();
  }

  /** Number of selectable rows currently shown (used for keyboard 1..N). */
  public getChoiceCount(): number {
    return this.choiceTexts.length;
  }

  /** Hide the box and drop its current content. */
  public clear(): void {
    this.visible = false;
    this.speakerText.text = "";
    this.bodyText.text = "";
    this.setChoices(null);
  }

  /**
   * Re-position the whole box bottom-center for a `width`×`height` viewport.
   * (SceneManager forwards window resizes here.)
   */
  public resize(width: number, height: number): void {
    this.position.set(
      Math.round((width - PANEL_WIDTH) / 2),
      Math.round(height - PANEL_HEIGHT - BOTTOM_GAP),
    );
  }

  /** Left edge of the speaker/body text block (avoids a visible portrait). */
  private textLeft(): number {
    return this.portrait.visible
      ? PORTRAIT_X + PORTRAIT_MAX_WIDTH + PORTRAIT_GAP
      : TEXT_X;
  }

  private bodyWrapWidth(left: number): number {
    return PANEL_WIDTH - left - RIGHT_MARGIN;
  }

  /** Pin speaker/body/choice rows to the current text block geometry. */
  private layoutRows(): void {
    const left = this.textLeft();
    this.speakerText.position.set(left, SPEAKER_Y);
    this.bodyText.position.set(left, BODY_Y);
    // Re-wrap the body to the available width (narrower next to a portrait).
    this.bodyText.style.wordWrapWidth = this.bodyWrapWidth(left);

    this.choiceTexts.forEach((row, idx) => {
      row.position.set(
        left + CHOICE_X_INDENT,
        CHOICES_TOP + idx * CHOICE_LINE_HEIGHT,
      );
    });
  }
}

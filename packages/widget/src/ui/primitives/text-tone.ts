import * as stylex from "@stylexjs/stylex";
import { color } from "../tokens/color.stylex";

/**
 * The text tones, shared by every part that colors text or an icon. `subtle`
 * is for disabled and decorative text only.
 */
export const textToneStyles = stylex.create({
  default: { color: color.text },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  accent: { color: color.accentText },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
});

/** A text tone. */
export type TextTone = keyof typeof textToneStyles;

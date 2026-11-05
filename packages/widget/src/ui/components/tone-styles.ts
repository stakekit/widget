import * as stylex from "@stylexjs/stylex";
import { color } from "../tokens/color.stylex";

/** A tone's soft tint with its text color on top. */
export const toneSoftStyles = stylex.create({
  neutral: { backgroundColor: color.surface, color: color.text },
  accent: { backgroundColor: color.accentSoft, color: color.accentText },
  success: { backgroundColor: color.successSoft, color: color.success },
  warning: { backgroundColor: color.warningSoft, color: color.warning },
  danger: { backgroundColor: color.dangerSoft, color: color.danger },
  info: { backgroundColor: color.infoSoft, color: color.info },
});

/**
 * A tone's text color, for text and icons on the canvas, a surface or a soft
 * tint.
 */
export const toneTextStyles = stylex.create({
  neutral: { color: color.text },
  accent: { color: color.accentText },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
  info: { color: color.info },
});

/** A tone's border color, for outlined parts. */
export const toneBorderStyles = stylex.create({
  neutral: { borderColor: color.borderStrong },
  accent: { borderColor: color.accent },
  success: { borderColor: color.success },
  warning: { borderColor: color.warning },
  danger: { borderColor: color.danger },
  info: { borderColor: color.info },
});

import * as stylex from "@stylexjs/stylex";

import { color } from "../tokens/color.stylex";
import { space } from "../tokens/space.stylex";
import { font, fontSize, lineHeight } from "../tokens/typography.stylex";

/**
 * The label a `Switch` or `Checkbox` sits in: clicking anywhere on it toggles
 * the control. Its text dims with the control's disabled state.
 */
export const choiceLabelStyles = stylex.create({
  root: {
    gap: space[12],
    alignItems: "center",
    color: color.text,
    cursor: "pointer",
    display: "inline-flex",
    fontFamily: font.sans,
    fontSize: fontSize.body,
    lineHeight: lineHeight.body,
    userSelect: "none",
  },
  disabled: { color: color.textMuted, cursor: "not-allowed" },
});

import * as stylex from "@stylexjs/stylex";
import type { IconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { borderWidth } from "../tokens/border.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import type { Tone } from "../tone";
import {
  toneBorderStyles,
  toneSoftStyles,
  toneTextStyles,
} from "./tone-styles";

/** A short status label: `soft` on the tone's tint, `outline` edged in it. */
export const Badge = ({
  tone = "neutral",
  variant = "soft",
  icon,
  children,
}: {
  readonly tone?: Tone;
  readonly variant?: "soft" | "outline";
  /** A decorative icon before the label. */
  readonly icon?: Exclude<IconName, "ArrowIcon">;
  readonly children: string;
}) => (
  <span
    {...stylex.props(
      styles.root,
      variant === "soft"
        ? toneSoftStyles[tone]
        : [styles.outline, toneTextStyles[tone], toneBorderStyles[tone]]
    )}
  >
    {icon && <Icon name={icon} size="sm" />}
    {children}
  </span>
);

const styles = stylex.create({
  root: {
    borderColor: "transparent",
    borderRadius: radius.badge,
    borderStyle: "solid",
    borderWidth: borderWidth.thin,
    gap: space[4],
    paddingBlock: space[2],
    paddingInline: space[8],
    alignItems: "center",
    boxSizing: "border-box",
    display: "inline-flex",
    flexShrink: 0,
    fontFamily: font.sans,
    fontSize: fontSize.caption,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.caption,
    whiteSpace: "nowrap",
  },
  outline: { backgroundColor: "transparent" },
});

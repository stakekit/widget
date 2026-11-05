import * as stylex from "@stylexjs/stylex";
import { toneSoftStyles } from "../components/tone-styles";
import type { FixedIconName } from "../icons/glyphs";
import { Icon } from "../primitives/icon";
import { opacity } from "../tokens/opacity.stylex";
import { radius } from "../tokens/radius.stylex";
import { spotSize } from "../tokens/size.stylex";

type SpotProps = {
  /** The icon the spot draws, from the Design System's set. */
  readonly icon: FixedIconName;
  /**
   * `neutral` for what is empty or informational, `accent` to draw the eye
   * in the preset's accent, `warning` and `danger` for what went wrong.
   */
  readonly tone?: keyof typeof toneStyles;
  /**
   * `md` heads a message in a page section; `lg` heads a dialog or a notice
   * that fills the Widget, in a soft halo.
   */
  readonly size?: "md" | "lg";
};

const toneStyles = {
  neutral: toneSoftStyles.neutral,
  accent: toneSoftStyles.accent,
  warning: toneSoftStyles.warning,
  danger: toneSoftStyles.danger,
} as const;

/**
 * A flat spot illustration: one icon of the set on a disc in a tone's soft
 * tint, drawn in the tone's color, so it follows the Color Roles of every
 * preset and color scheme. It is decorative and hidden from assistive
 * technology; the message beside it carries the meaning.
 */
export const Spot = ({ icon, tone = "neutral", size = "md" }: SpotProps) => {
  const disc = (
    <span
      aria-hidden
      {...stylex.props(styles.disc, sizeStyles[size], toneStyles[tone])}
    >
      <Icon name={icon} size={size === "lg" ? "xl" : "lg"} />
    </span>
  );

  if (size === "md") return disc;

  return (
    <span aria-hidden {...stylex.props(styles.halo)}>
      <span {...stylex.props(styles.haloRing, toneStyles[tone])} />
      {disc}
    </span>
  );
};

const styles = stylex.create({
  disc: {
    borderRadius: radius.pill,
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    position: "relative",
  },
  halo: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    justifyContent: "center",
    position: "relative",
    height: spotSize.halo,
    width: spotSize.halo,
  },
  haloRing: {
    inset: 0,
    borderRadius: radius.pill,
    opacity: opacity.halo,
    position: "absolute",
  },
});

const sizeStyles = stylex.create({
  md: { height: spotSize.md, width: spotSize.md },
  lg: { height: spotSize.lg, width: spotSize.lg },
});

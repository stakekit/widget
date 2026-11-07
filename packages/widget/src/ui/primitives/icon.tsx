import * as stylex from "@stylexjs/stylex";
import { type FixedIconName, glyphs, glyphViewBox } from "../icons/glyphs";
import { iconSize } from "../tokens/size.stylex";
import { type TextTone, textToneStyles } from "./text-tone";

/** The way `ArrowIcon` points. */
type ArrowDirection = "down" | "up" | "left" | "right";

type CommonProps = {
  /** 16, 20, 24 or, for an icon that illustrates, 32px. */
  readonly size?: keyof typeof sizeStyles;
  /** Meaning through color. Unset draws in the surrounding text color. */
  readonly tone?: TextTone;
  /** Names the icon for assistive technology. Unset, the icon is decorative and hidden. */
  readonly label?: string;
};

type IconProps = CommonProps &
  (
    | { readonly name: "ArrowIcon"; readonly direction: ArrowDirection }
    | {
        readonly name: FixedIconName;
        readonly direction?: never;
      }
  );

/**
 * The stroke width, in units of the glyphs' 24-unit grid, that draws a 1.5px
 * line at each size, so every icon keeps one stroke whatever its size.
 */
const strokeWidths = {
  sm: 2.25,
  md: 1.8,
  lg: 1.5,
  xl: 1.125,
} as const satisfies Record<keyof typeof sizeStyles, number>;

/** One named icon from the Design System's set. */
export const Icon = ({
  name,
  direction,
  size = "md",
  tone,
  label,
}: IconProps) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox={glyphViewBox}
    fill="none"
    stroke="currentColor"
    strokeWidth={strokeWidths[size]}
    strokeLinecap="round"
    strokeLinejoin="round"
    focusable="false"
    {...(label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ role: "img", "aria-label": label } as const))}
    {...stylex.props(
      styles.root,
      sizeStyles[size],
      tone && textToneStyles[tone],
      direction && directionStyles[direction]
    )}
  >
    {glyphs[name]}
  </svg>
);

const styles = stylex.create({
  root: { display: "block", flexShrink: 0 },
});

const sizeStyles = stylex.create({
  sm: { height: iconSize.sm, width: iconSize.sm },
  md: { height: iconSize.md, width: iconSize.md },
  lg: { height: iconSize.lg, width: iconSize.lg },
  xl: { height: iconSize.xl, width: iconSize.xl },
});

const directionStyles = stylex.create({
  down: { transform: "none" },
  up: { transform: "rotate(180deg)" },
  left: { transform: "rotate(90deg)" },
  right: { transform: "rotate(-90deg)" },
});

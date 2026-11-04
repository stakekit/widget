import * as stylex from "@stylexjs/stylex";
import { glyphs, type IconName } from "../icons/glyphs";
import { iconSize } from "../tokens/size.stylex";
import { type TextTone, textToneStyles } from "./text-tone";

/** The way `ArrowIcon` points. */
type ArrowDirection = "down" | "up" | "left" | "right";

type CommonProps = {
  /** 16, 20 or 24px. */
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
        readonly name: Exclude<IconName, "ArrowIcon">;
        readonly direction?: never;
      }
  );

/** One named icon from the Design System's set. */
export const Icon = ({
  name,
  direction,
  size = "md",
  tone,
  label,
}: IconProps) => {
  const glyph = glyphs[name];

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={glyph.viewBox}
      fill="none"
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
      {glyph.body}
    </svg>
  );
};

const styles = stylex.create({
  root: { display: "block", flexShrink: 0 },
});

const sizeStyles = stylex.create({
  sm: { height: iconSize.sm, width: iconSize.sm },
  md: { height: iconSize.md, width: iconSize.md },
  lg: { height: iconSize.lg, width: iconSize.lg },
});

const directionStyles = stylex.create({
  down: { transform: "none" },
  up: { transform: "rotate(180deg)" },
  left: { transform: "rotate(90deg)" },
  right: { transform: "rotate(-90deg)" },
});

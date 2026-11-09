import * as stylex from "@stylexjs/stylex";

import { iconSize } from "../tokens/size.stylex";

/**
 * The Morpho mark, in Morpho's blue. Artwork keeps its own colors, so it is
 * exempt from the Color Role rules and never themed.
 */
export const MorphoMark = ({
  size = "sm",
  label,
}: {
  readonly size?: keyof typeof sizeStyles;
  /** Names the mark; unset, it is decorative. */
  readonly label?: string;
}) => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    viewBox="0 0 15 14"
    fill="none"
    focusable="false"
    {...(label === undefined
      ? ({ "aria-hidden": true } as const)
      : ({ role: "img", "aria-label": label } as const))}
    {...stylex.props(styles.root, sizeStyles[size])}
  >
    <path
      fill="#2470FFE6"
      fillRule="evenodd"
      clipRule="evenodd"
      d="M4.79.7a.7.7 0 1 0-1.4 0c0 .21-.112.478-.342.708-.23.23-.498.342-.708.342a.7.7 0 0 0 0 1.4c.21 0 .478.112.708.342.23.23.342.498.342.708a.7.7 0 0 0 1.4 0c0-.21.112-.478.342-.708.23-.23.498-.342.708-.342a.7.7 0 1 0 0-1.4c-.202 0-.47-.113-.705-.35C4.9 1.16 4.79.89 4.79.7Zm5.6 2.1a.7.7 0 0 1 .7.7c0 .527.284 1.147.783 1.652.497.504 1.115.798 1.667.798a.7.7 0 1 1 0 1.4c-.56 0-1.178.287-1.67.78-.493.492-.78 1.11-.78 1.67a.7.7 0 1 1-1.4 0c0-.56-.287-1.178-.78-1.67-.492-.493-1.11-.78-1.67-.78a.7.7 0 1 1 0-1.4c.56 0 1.178-.287 1.67-.78.493-.492.78-1.11.78-1.67a.7.7 0 0 1 .7-.7Zm-7 4.9a.7.7 0 0 1 .7.7c0 .359.196.804.564 1.176.366.37.81.574 1.186.574a.7.7 0 1 1 0 1.4c-.385 0-.828.2-1.19.56-.36.362-.56.805-.56 1.19a.7.7 0 1 1-1.4 0c0-.385-.2-.828-.56-1.19-.361-.36-.805-.56-1.19-.56a.7.7 0 1 1 0-1.4c.385 0 .829-.2 1.19-.56.36-.362.56-.805.56-1.19a.7.7 0 0 1 .7-.7Z"
    />
  </svg>
);

const styles = stylex.create({
  root: { display: "block", flexShrink: 0 },
});

const sizeStyles = stylex.create({
  sm: { height: iconSize.sm, width: iconSize.sm },
  md: { height: iconSize.md, width: iconSize.md },
  lg: { height: iconSize.lg, width: iconSize.lg },
});

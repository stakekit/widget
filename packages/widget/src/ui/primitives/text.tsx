import * as stylex from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";

import type { FixedIconName } from "../icons/glyphs";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  figureWeight,
  font,
  fontSize,
  fontWeight,
  lineHeight,
  roleWeight,
  tracking,
} from "../tokens/typography.stylex";
import { Icon } from "./icon";
import { InlineIcon } from "./inline-icon";
import { type TextTone, textToneStyles } from "./text-tone";
import type { BodyRole, HeadingRole } from "./type-role";

type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type TextElement = "p" | "span" | "div" | "label" | "strong" | "small";

type CommonProps = {
  /** Meaning through color. Unset inherits the surrounding color. */
  readonly tone?: TextTone;
  /** Overrides the role's weight. */
  readonly weight?: keyof typeof weightStyles;
  /** Tabular figures, so digits line up. `display` and `metric` always are. */
  readonly numeric?: boolean;
  /** One line, cut with an ellipsis. */
  readonly truncate?: boolean;
  /** Aligns the lines, such as `center` under a centered icon. */
  readonly align?: keyof typeof alignStyles;
  /** Breaks a long unbroken run, such as a full-precision amount, anywhere. */
  readonly breakAnywhere?: boolean;
  /**
   * A small icon inline at the start of the first line, in the text's tone,
   * such as `InfoIcon` on an info line. Wrapped lines start under the icon,
   * at the text's own left edge.
   */
  readonly icon?: FixedIconName;
  readonly id?: string;
  readonly children?: ReactNode;
};

/** A heading role must name its element; a body role defaults to `span`. */
type TextProps = CommonProps &
  (
    | {
        readonly variant: HeadingRole;
        readonly as: HeadingElement | TextElement;
      }
    | { readonly variant?: BodyRole; readonly as?: TextElement }
  );

const TextRoot = ({
  variant = "body",
  as = "span",
  tone,
  weight,
  numeric = false,
  truncate = false,
  align,
  breakAnywhere = false,
  icon,
  children,
  ...rest
}: TextProps) =>
  createElement(
    as,
    {
      ...rest,
      ...stylex.props(
        styles.root,
        roleStyles[variant],
        tone && textToneStyles[tone],
        weight && weightStyles[weight],
        numeric && styles.numeric,
        truncate && styles.truncate,
        align && alignStyles[align],
        breakAnywhere && styles.breakAnywhere
      ),
    },
    icon && (
      <InlineIcon variant={variant} gap={4}>
        <Icon name={icon} size="sm" />
      </InlineIcon>
    ),
    children
  );

const styles = stylex.create({
  root: {
    margin: 0,
    fontFamily: font.sans,
  },
  // Figures take the figure font, which a preset may set apart.
  numeric: { fontFamily: font.figure, fontVariantNumeric: "tabular-nums" },
  truncate: {
    overflow: "hidden",
    display: "block",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
  breakAnywhere: { overflowWrap: "anywhere" },
});

const alignStyles = stylex.create({
  start: { textAlign: "start" },
  center: { textAlign: "center" },
  end: { textAlign: "end" },
});

// A title is a step heavier than a heading, so the two read apart.
const roleStyles = stylex.create({
  display: {
    fontFamily: font.figure,
    fontSize: fontSize.display,
    fontVariantNumeric: "tabular-nums",
    fontWeight: figureWeight.display,
    letterSpacing: tracking.display,
    lineHeight: lineHeight.display,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.title,
  },
  heading: {
    fontSize: fontSize.heading,
    fontWeight: roleWeight.heading,
    lineHeight: lineHeight.heading,
  },
  metric: {
    fontFamily: font.figure,
    fontSize: fontSize.metric,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.metric,
  },
  body: {
    fontSize: fontSize.body,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.body,
  },
  label: {
    fontSize: fontSize.label,
    fontWeight: fontWeight.medium,
    lineHeight: lineHeight.label,
  },
  caption: {
    fontSize: fontSize.caption,
    fontWeight: fontWeight.regular,
    lineHeight: lineHeight.caption,
  },
  overline: {
    fontSize: fontSize.overline,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.overline,
    textTransform: "uppercase",
  },
});

/**
 * Emphasis inside translated copy, for `<Trans components>`: it keeps the
 * surrounding role and tone and strengthens the weight.
 */
const Strong = ({ children }: { readonly children?: ReactNode }) => (
  <strong {...stylex.props(emphasisStyles.strong)}>{children}</strong>
);

/**
 * A highlighted run inside translated copy, for `<Trans components>`, such as
 * a token symbol or an amount the sentence is about.
 */
const Mark = ({ children }: { readonly children?: ReactNode }) => (
  <mark {...stylex.props(emphasisStyles.mark)}>{children}</mark>
);

/**
 * A line break inside translated copy, for `<Trans components>`, where the
 * translation separates lines with `<br0/>`.
 */
const Break = () => <br />;

/**
 * Text in one of the type roles. Heading roles require `as`, so a look never
 * decides the document outline. `Text.Strong` and `Text.Mark` emphasize runs
 * inside it; `Text.Break` breaks a line in it.
 */
export const Text = Object.assign(TextRoot, { Strong, Mark, Break });

const emphasisStyles = stylex.create({
  strong: { fontWeight: fontWeight.semibold },
  mark: {
    borderRadius: radius.badge,
    paddingInline: space[4],
    backgroundColor: color.accentSoft,
    boxDecorationBreak: "clone",
    color: color.text,
  },
});

const weightStyles = stylex.create({
  regular: { fontWeight: fontWeight.regular },
  medium: { fontWeight: fontWeight.medium },
  semibold: { fontWeight: fontWeight.semibold },
});

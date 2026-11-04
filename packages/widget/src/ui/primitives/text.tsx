import * as stylex from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import { color } from "../tokens/color.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";

/** Type roles that title something; they must name their element. */
type HeadingRole = "display" | "title" | "heading";
type BodyRole = "metric" | "body" | "label" | "caption" | "overline";
type HeadingElement = "h1" | "h2" | "h3" | "h4" | "h5" | "h6";
type TextElement = "p" | "span" | "div" | "label" | "strong" | "small";

type CommonProps = {
  /** Meaning through color. Unset inherits the surrounding color. */
  readonly tone?: keyof typeof toneStyles;
  /** Overrides the role's weight. */
  readonly weight?: keyof typeof weightStyles;
  /** Tabular figures, so digits line up. `display` and `metric` always are. */
  readonly numeric?: boolean;
  /** One line, cut with an ellipsis. */
  readonly truncate?: boolean;
  readonly id?: string;
  readonly children?: ReactNode;
};

/**
 * Text in one of the type roles. Heading roles require `as`, so a look never
 * decides the document outline.
 */
type TextProps = CommonProps &
  (
    | {
        readonly variant: HeadingRole;
        readonly as: HeadingElement | TextElement;
      }
    | { readonly variant?: BodyRole; readonly as?: TextElement }
  );

export const Text = ({
  variant = "body",
  as = "span",
  tone,
  weight,
  numeric = false,
  truncate = false,
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
        tone && toneStyles[tone],
        weight && weightStyles[weight],
        numeric && styles.numeric,
        truncate && styles.truncate
      ),
    },
    children
  );

const styles = stylex.create({
  root: {
    margin: 0,
    fontFamily: font.sans,
  },
  numeric: { fontVariantNumeric: "tabular-nums" },
  truncate: {
    overflow: "hidden",
    display: "block",
    textOverflow: "ellipsis",
    whiteSpace: "nowrap",
  },
});

const roleStyles = stylex.create({
  display: {
    fontSize: fontSize.display,
    fontVariantNumeric: "tabular-nums",
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.display,
  },
  title: {
    fontSize: fontSize.title,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.title,
  },
  heading: {
    fontSize: fontSize.heading,
    fontWeight: fontWeight.semibold,
    lineHeight: lineHeight.heading,
  },
  metric: {
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

const toneStyles = stylex.create({
  default: { color: color.text },
  muted: { color: color.textMuted },
  subtle: { color: color.textSubtle },
  accent: { color: color.accentText },
  success: { color: color.success },
  warning: { color: color.warning },
  danger: { color: color.danger },
});

const weightStyles = stylex.create({
  regular: { fontWeight: fontWeight.regular },
  medium: { fontWeight: fontWeight.medium },
  semibold: { fontWeight: fontWeight.semibold },
});

import * as stylex from "@stylexjs/stylex";
import { createElement, type ReactNode } from "react";
import { color } from "../tokens/color.stylex";
import { radius } from "../tokens/radius.stylex";
import { space } from "../tokens/space.stylex";
import {
  font,
  fontSize,
  fontWeight,
  lineHeight,
} from "../tokens/typography.stylex";
import { type TextTone, textToneStyles } from "./text-tone";

/** Type roles that title something; they must name their element. */
type HeadingRole = "display" | "title" | "heading";
type BodyRole = "metric" | "body" | "label" | "caption" | "overline";
/** A type role: size, line height and weight together. */
export type TypeRole = HeadingRole | BodyRole;
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
 * Text in one of the type roles. Heading roles require `as`, so a look never
 * decides the document outline. `Text.Strong` and `Text.Mark` emphasize runs
 * inside it.
 */
export const Text = Object.assign(TextRoot, { Strong, Mark });

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

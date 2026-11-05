import * as stylex from "@stylexjs/stylex";
import type { TypeRole } from "../primitives/type-role";
import { color } from "../tokens/color.stylex";
import { motion } from "../tokens/motion.stylex";
import { radius } from "../tokens/radius.stylex";
import {
  avatarSize,
  controlHeight,
  skeletonHeight,
} from "../tokens/size.stylex";
import { fontSize, lineHeight } from "../tokens/typography.stylex";

const pulse = stylex.keyframes({
  "0%": { opacity: 1 },
  "50%": { opacity: 0.5 },
  "100%": { opacity: 1 },
});

type SkeletonWidth = keyof typeof widthStyles;

type SkeletonProps =
  | {
      /** A block, such as a control or a card, at a control height. */
      readonly shape: "rect";
      readonly height?: keyof typeof rectHeightStyles;
      readonly width?: SkeletonWidth;
    }
  | {
      /** A line of text in a type role: it takes the role's line height. */
      readonly shape: "line";
      readonly role?: TypeRole;
      readonly width?: SkeletonWidth;
    }
  | {
      /** An avatar at an avatar size. */
      readonly shape: "circle";
      readonly size?: keyof typeof circleStyles;
    };

/**
 * A placeholder for content that is loading. It is decorative: the region
 * that loads says it is busy.
 */
export const Skeleton = (props: SkeletonProps) => (
  <span
    aria-hidden="true"
    {...stylex.props(
      styles.root,
      props.shape === "rect" && [
        styles.rect,
        rectHeightStyles[props.height ?? "md"],
        widthStyles[props.width ?? "full"],
      ],
      props.shape === "line" && [
        styles.line,
        lineStyles[props.role ?? "body"],
        widthStyles[props.width ?? "full"],
      ],
      props.shape === "circle" && [
        styles.circle,
        circleStyles[props.size ?? "md"],
      ]
    )}
  />
);

const styles = stylex.create({
  root: {
    animationDuration: motion.pulse,
    animationIterationCount: "infinite",
    animationName: pulse,
    animationTimingFunction: motion.easing,
    backgroundColor: color.border,
    boxSizing: "border-box",
    display: "block",
    flexShrink: 0,
  },
  rect: { borderRadius: radius.control },
  // The fill covers the role's glyph height, centered in its line height.
  line: { borderRadius: radius.badge, backgroundClip: "content-box" },
  circle: { borderRadius: radius.pill },
});

const widthStyles = stylex.create({
  full: { width: "100%" },
  threeQuarters: { width: "75%" },
  half: { width: "50%" },
  quarter: { width: "25%" },
});

const rectHeightStyles = stylex.create({
  sm: { height: controlHeight.sm },
  md: { height: controlHeight.md },
  lg: { height: controlHeight.lg },
  // The parent's height, such as a chart's plot.
  fill: { height: "100%" },
  // A block taller than a control, such as an amount panel or a section.
  panel: { height: skeletonHeight.panel },
  section: { height: skeletonHeight.section },
});

const lineStyles = stylex.create({
  display: {
    paddingBlock: `calc((${lineHeight.display} - ${fontSize.display}) / 2)`,
    height: lineHeight.display,
  },
  title: {
    paddingBlock: `calc((${lineHeight.title} - ${fontSize.title}) / 2)`,
    height: lineHeight.title,
  },
  heading: {
    paddingBlock: `calc((${lineHeight.heading} - ${fontSize.heading}) / 2)`,
    height: lineHeight.heading,
  },
  metric: {
    paddingBlock: `calc((${lineHeight.metric} - ${fontSize.metric}) / 2)`,
    height: lineHeight.metric,
  },
  body: {
    paddingBlock: `calc((${lineHeight.body} - ${fontSize.body}) / 2)`,
    height: lineHeight.body,
  },
  label: {
    paddingBlock: `calc((${lineHeight.label} - ${fontSize.label}) / 2)`,
    height: lineHeight.label,
  },
  caption: {
    paddingBlock: `calc((${lineHeight.caption} - ${fontSize.caption}) / 2)`,
    height: lineHeight.caption,
  },
  overline: {
    paddingBlock: `calc((${lineHeight.overline} - ${fontSize.overline}) / 2)`,
    height: lineHeight.overline,
  },
});

const circleStyles = stylex.create({
  xs: { height: avatarSize.xs, width: avatarSize.xs },
  sm: { height: avatarSize.sm, width: avatarSize.sm },
  md: { height: avatarSize.md, width: avatarSize.md },
  lg: { height: avatarSize.lg, width: avatarSize.lg },
  xl: { height: avatarSize.xl, width: avatarSize.xl },
});

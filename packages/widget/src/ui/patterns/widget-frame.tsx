import * as stylex from "@stylexjs/stylex";
import { type AnimationDefinition, motion } from "motion/react";
import { type ReactNode, useEffect, useRef, useState } from "react";
import { Logo } from "../artwork/logo";
import { useReducedMotion } from "../components/use-reduced-motion";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { color } from "../tokens/color.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motionEasing, motionSeconds } from "../tokens/motion-timing";
import { gutter } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import { containerWidth } from "../tokens/size.stylex";
import { space } from "../tokens/space.stylex";
import { font } from "../tokens/typography.stylex";

type WidgetFrameProps = {
  /** Above the page, such as the wallet controls and tabs. */
  readonly header?: ReactNode;
  /** The page. */
  readonly children: ReactNode;
  /** The footer's text before the brand name, such as "Powered by". */
  readonly poweredByLabel: string;
  /** The brand the footer names after the label, such as "StakeKit". */
  readonly brandName: string;
  /**
   * `narrow` caps the frame at the `sm` container size and centers it;
   * `full` fills the width it is given.
   */
  readonly width?: keyof typeof widthStyles;
  /**
   * The frame's height eases to its content's as pages change, rather than
   * jumping. Off under reduced motion.
   */
  readonly animateHeight?: boolean;
  /**
   * On mount the frame grows open from no height once `ready`, such as when
   * the first page can show. Unset, the frame shows at its height at once.
   * Off under reduced motion.
   */
  readonly reveal?: { readonly ready: boolean };
};

/**
 * The Widget's shell: a rounded canvas that holds the header and the page at
 * the gutter inset, and the "Powered by" footer. It is a size container, so
 * what it holds lays out by the frame's width, not the page's. It can ease
 * its height between pages and grow open on mount.
 */
export const WidgetFrame = ({
  header,
  children,
  poweredByLabel,
  brandName,
  width = "narrow",
  animateHeight = false,
  reveal,
}: WidgetFrameProps) => {
  const reduceMotion = useReducedMotion();
  const animated = !reduceMotion && (animateHeight || reveal !== undefined);
  const content = useRef<HTMLDivElement>(null);
  const [contentHeight, setContentHeight] = useState<number>();
  const [revealed, setRevealed] = useState(reveal === undefined);

  useEffect(() => {
    const element = content.current;
    if (!animated || element === null) return;
    const observer = new ResizeObserver(([entry]) => {
      const height = entry?.borderBoxSize[0]?.blockSize;
      if (height !== undefined) setContentHeight(height);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [animated]);

  const opening = animated && !revealed;
  const closed = opening && reveal?.ready !== true;
  const height = closed ? 0 : (contentHeight ?? "auto");
  const target = animated ? { height } : { height: "auto" };
  const transition = transitionFor(animated, opening, animateHeight);

  const onAnimationComplete = (definition: AnimationDefinition) => {
    const settled =
      typeof definition === "object" &&
      "height" in definition &&
      definition.height === contentHeight;
    if (opening && !closed && settled) setRevealed(true);
  };

  return (
    <motion.div
      initial={opening ? { height: 0 } : false}
      animate={target}
      transition={transition}
      onAnimationComplete={onAnimationComplete}
      className={stylex.props(styles.root, widthStyles[width]).className}
    >
      <div
        ref={content}
        {...stylex.props(styles.content, animated && styles.measured)}
      >
        {header !== undefined && (
          <div {...stylex.props(styles.header)}>{header}</div>
        )}
        <div {...stylex.props(styles.page)}>{children}</div>
        {/* Not a `footer`: the host page owns its contentinfo landmark. */}
        <div {...stylex.props(styles.footer)}>
          <Stack direction="row" align="center" justify="center" gap={4}>
            <Text variant="caption" tone="muted">
              {poweredByLabel} <Text.Strong>{brandName}</Text.Strong>
            </Text>
            <Logo size="sm" />
          </Stack>
        </div>
      </div>
    </motion.div>
  );
};

/** The mount reveal is slower than a page change; without motion, no time. */
const transitionFor = (
  animated: boolean,
  opening: boolean,
  animateHeight: boolean
) => {
  if (!animated) return { duration: 0 };
  if (opening) return { duration: motionSeconds.reveal, ease: motionEasing };
  if (animateHeight) {
    return { duration: motionSeconds.slow, ease: motionEasing };
  }
  return { duration: 0 };
};

const styles = stylex.create({
  root: {
    borderRadius: radius.shell,
    marginInline: "auto",
    overflow: "hidden",
    backgroundColor: color.background,
    boxShadow: elevation.shell,
    boxSizing: "border-box",
    color: color.text,
    containerType: "inline-size",
    display: "flex",
    flexDirection: "column",
    fontFamily: font.sans,
    position: "relative",
  },
  content: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
  // Measured, the content keeps its own height, which the frame eases to.
  measured: { flexGrow: 0, flexShrink: 0 },
  header: {
    paddingInline: gutter.size,
    flexShrink: 0,
    paddingTop: gutter.size,
  },
  page: {
    gap: gutter.size,
    paddingInline: gutter.size,
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
    paddingTop: gutter.size,
  },
  footer: {
    paddingBlock: space[12],
    flexShrink: 0,
  },
});

const widthStyles = stylex.create({
  narrow: { maxWidth: containerWidth.sm, width: "100%" },
  full: { width: "100%" },
});

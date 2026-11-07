import * as stylex from "@stylexjs/stylex";
import { type AnimationDefinition, motion } from "motion/react";
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { Logo } from "../artwork/logo";
import { useReducedMotion } from "../components/use-reduced-motion";
import type { HostHook } from "../host-hook";
import { Stack } from "../primitives/stack";
import { Text } from "../primitives/text";
import { color } from "../tokens/color.stylex";
import { container } from "../tokens/container.stylex";
import { elevation } from "../tokens/elevation.stylex";
import { motionEasing, motionSeconds } from "../tokens/motion-timing";
import { gutter } from "../tokens/presentation.stylex";
import { radius } from "../tokens/radius.stylex";
import {
  containerWidth,
  frameMaxWidth,
  frameMinHeight,
} from "../tokens/size.stylex";
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
   * `wide` fills the width it is given up to a split-view frame's width and
   * centers it, and below the `split` container size holds its header and
   * page in one centred column no wider than the `md` container size, the
   * stacked split view's; `full` fills the width it is given. `narrow` and
   * `wide` keep a least height, so short pages and states don't shrink the
   * Widget.
   */
  readonly width?: keyof typeof widthStyles;
  /**
   * Names the page shown. When it changes, the frame's height eases to the
   * new page's for as long as the page is settling in, rather than jumping;
   * otherwise the frame follows its content's height, so what resizes within
   * a page, such as a disclosure, animates on its own. Unset, the frame never
   * eases between pages. Off under reduced motion.
   */
  readonly pageKey?: string;
  /**
   * On mount the frame grows open from no height once `ready`, such as when
   * the first page can show. Unset, the frame shows at its height at once.
   * Off under reduced motion. `onRevealed` is called once the frame is open:
   * when the opening ends, or once `ready` without motion.
   */
  readonly reveal?: {
    readonly ready: boolean;
    readonly onRevealed?: () => void;
  };
  /** Rendered on the frame as `data-rk`. */
  readonly hostHook?: HostHook;
};

/**
 * The Widget's shell: a rounded canvas that holds the header and the page at
 * the gutter inset, and the "Powered by" footer. As wide as the viewport,
 * such as on a phone, it drops its corners and edge and meets the screen's.
 * It is a size container, so what it holds lays out by the frame's width,
 * not the page's. It can ease its height between pages and grow open on
 * mount.
 */
export const WidgetFrame = ({
  header,
  children,
  poweredByLabel,
  brandName,
  width = "narrow",
  pageKey,
  reveal,
  hostHook,
}: WidgetFrameProps) => {
  const reduceMotion = useReducedMotion();
  const animated =
    !reduceMotion && (pageKey !== undefined || reveal !== undefined);
  const content = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  const fillsViewport = useFillsViewportWidth(frame);
  const [contentHeight, setContentHeight] = useState<number>();
  // The height the frame eases to during a page change.
  const [pageHeight, setPageHeight] = useState<number>();
  const [revealed, setRevealed] = useState(reveal === undefined);
  const [shownPageKey, setShownPageKey] = useState(pageKey);
  // Set anew on each page change, so each restarts the settle wait. `from`
  // is the frame's height as the change begins.
  const [pageChange, setPageChange] = useState<{
    readonly to: string | undefined;
    readonly from: number | undefined;
  } | null>(null);
  // The old page's height, held for the commit that swaps the page in: until
  // a page change the frame fits its content as laid out, so that commit
  // would resize it at once. Released once the easing writes a height.
  const [pinnedHeight, setPinnedHeight] = useState<number>();

  if (pageKey !== shownPageKey) {
    setShownPageKey(pageKey);
    if (animated && revealed) {
      const from = pageChange === null ? contentHeight : pageHeight;
      setPageChange({ to: pageKey, from });
      setPageHeight(from);
      if (pageChange === null) setPinnedHeight(from);
    }
  }

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

  // During a page change the frame grows with its content at once but
  // shrinks only once a smaller height has held for the shrink delay, so the
  // moment between pages, empty or still loading, never dips it. The change
  // lasts until the content's height has held still for the settle time,
  // which covers the old page's exit and the new page's first layout.
  useEffect(() => {
    const element = content.current;
    if (pageChange === null || element === null) return;
    let shown = pageChange.from ?? 0;
    let settleTimer = 0;
    let shrinkTimer = 0;
    const settle = () => {
      window.clearTimeout(settleTimer);
      settleTimer = window.setTimeout(() => {
        setPageChange(null);
        setPinnedHeight(undefined);
      }, settleMs);
    };
    const show = (height: number) => {
      shown = height;
      setPageHeight(height);
    };
    settle();
    const observer = new ResizeObserver(([entry]) => {
      settle();
      const height = entry?.borderBoxSize[0]?.blockSize;
      if (height === undefined) return;
      window.clearTimeout(shrinkTimer);
      if (height >= shown) show(height);
      else shrinkTimer = window.setTimeout(() => show(height), shrinkDelayMs);
    });
    observer.observe(element);
    return () => {
      observer.disconnect();
      window.clearTimeout(settleTimer);
      window.clearTimeout(shrinkTimer);
    };
  }, [pageChange]);

  const opening = animated && !revealed;
  const closed = opening && reveal?.ready !== true;
  const easing = animated && pageChange !== null;
  const target = heightFor({
    closed,
    height: opening ? contentHeight : pageHeight,
    opening,
    easing,
  });
  const transition = transitionFor(opening, easing);
  const open = revealed || (!animated && reveal?.ready === true);
  const onRevealed = reveal?.onRevealed;

  useEffect(() => {
    if (open) onRevealed?.();
  }, [open, onRevealed]);

  const onAnimationComplete = (definition: AnimationDefinition) => {
    const settled =
      typeof definition === "object" &&
      "height" in definition &&
      definition.height === contentHeight;
    if (opening && !closed && settled) setRevealed(true);
  };

  return (
    <motion.div
      ref={frame}
      initial={opening ? { height: 0 } : false}
      animate={target}
      transition={transition}
      onUpdate={() => {
        if (pinnedHeight !== undefined) setPinnedHeight(undefined);
      }}
      onAnimationComplete={onAnimationComplete}
      {...stylex.props(
        styles.root,
        widthStyles[width],
        fillsViewport && styles.edgeToEdge,
        pinnedHeight !== undefined && styles.pinned(`${pinnedHeight}px`)
      )}
      data-rk={hostHook}
      data-sk-frame=""
    >
      <div
        ref={content}
        {...stylex.props(
          styles.content,
          minHeightStyles[width],
          animated && styles.measured
        )}
      >
        {header !== undefined && (
          <div {...stylex.props(styles.header, columnStyles[width])}>
            {header}
          </div>
        )}
        <div {...stylex.props(styles.page, columnStyles[width])}>
          {children}
        </div>
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

/**
 * Whether the element is as wide as the viewport, kept current as either
 * resizes. Read before paint, so a full-width frame never shows its corners.
 */
const useFillsViewportWidth = (ref: RefObject<HTMLElement | null>) => {
  const [fills, setFills] = useState(false);

  useLayoutEffect(() => {
    const element = ref.current;
    if (element === null) return;
    const viewport = element.ownerDocument.documentElement;
    const view = element.ownerDocument.defaultView;
    const update = () =>
      setFills(
        element.getBoundingClientRect().width >= viewport.clientWidth - 0.5
      );
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    view?.addEventListener("resize", update);
    return () => {
      observer.disconnect();
      view?.removeEventListener("resize", update);
    };
  }, [ref]);

  return fills;
};

const settleMs = motionSeconds.pageSettle * 1000;
const shrinkDelayMs = motionSeconds.pageShrinkDelay * 1000;

/**
 * While it grows open or eases between pages the frame takes the measured
 * `height`; otherwise it fits its content as laid out.
 */
const heightFor = ({
  closed,
  height,
  opening,
  easing,
}: {
  readonly closed: boolean;
  readonly height: number | undefined;
  readonly opening: boolean;
  readonly easing: boolean;
}) => {
  if (closed) return { height: 0 };
  if (opening || easing) return { height: height ?? "auto" };
  return { height: "auto" };
};

/** The mount reveal is slower than a page change; otherwise no time. */
const transitionFor = (opening: boolean, easing: boolean) => {
  if (opening) return { duration: motionSeconds.reveal, ease: motionEasing };
  if (easing) return { duration: motionSeconds.slow, ease: motionEasing };
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
  // Wins over the height `motion` writes inline, which is `auto` until the
  // easing starts.
  pinned: (height: string) => ({ maxHeight: height, minHeight: height }),
  // As wide as the viewport, the frame meets the screen's edges: no corners,
  // no shadow or edge around it.
  edgeToEdge: { borderRadius: 0, boxShadow: "none" },
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
  wide: { maxWidth: frameMaxWidth.wide, width: "100%" },
  full: { width: "100%" },
});

// The header and the page share one column: below the `split` container
// size a `wide` frame centres it at the stacked split view's width, so the
// tabs and wallet controls line up with the page under them.
const columnStyles = stylex.create({
  narrow: {},
  wide: {
    marginInline: "auto",
    boxSizing: "border-box",
    maxWidth: {
      default: `calc(${containerWidth.md} + 2 * ${gutter.size})`,
      [container.split]: "none",
    },
    width: "100%",
  },
  full: {},
});

// On the content, not the frame, so the frame can still grow open from no
// height; the page grows into the space, and the footer stays at the foot.
const minHeightStyles = stylex.create({
  narrow: { minHeight: frameMinHeight.narrow },
  wide: { minHeight: frameMinHeight.wide },
  full: { minHeight: null },
});

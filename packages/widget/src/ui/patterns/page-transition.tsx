import * as stylex from "@stylexjs/stylex";
import {
  AnimatePresence,
  motion,
  type TargetAndTransition,
} from "motion/react";
import type { ReactNode } from "react";

import { useReducedMotion } from "../components/use-reduced-motion";
import {
  motionEasing,
  motionSeconds,
  pageMotion,
} from "../tokens/motion-timing";

type PageMotion = {
  readonly initial: TargetAndTransition;
  readonly animate: TargetAndTransition;
  readonly exit: TargetAndTransition;
};

const variants = {
  // Rises into place; leaves blurred and shrinking.
  rise: {
    initial: { opacity: 0, y: -pageMotion.rise },
    animate: {
      opacity: 1,
      y: 0,
      transition: { duration: motionSeconds.slow, ease: motionEasing },
    },
    exit: {
      opacity: 0,
      filter: pageMotion.blur,
      scale: pageMotion.shrink,
      transition: { duration: motionSeconds.base, ease: motionEasing },
    },
  },
  // Fades in; leaves blurred.
  fade: {
    initial: { opacity: 0 },
    animate: {
      opacity: 1,
      transition: { duration: motionSeconds.slow, ease: motionEasing },
    },
    exit: {
      opacity: 0,
      filter: pageMotion.blur,
      transition: { duration: motionSeconds.fast, ease: motionEasing },
    },
  },
} as const satisfies Record<string, PageMotion>;

// Under reduced motion a page swaps in its final state: nothing moves.
const still = {
  initial: { opacity: 1 },
  animate: { opacity: 1, transition: { duration: 0 } },
  exit: { opacity: 0, transition: { duration: 0 } },
} as const satisfies PageMotion;

type PageTransitionProps = {
  /** Identifies the page; a new key replaces the page with a transition. */
  readonly pageKey: string;
  readonly variant: keyof typeof variants;
  /**
   * The leaving page finishes leaving before the next one enters; otherwise
   * the two transitions run together.
   */
  readonly waitForExit?: boolean;
  /** Fills the parent's height as a column, for a page that scrolls inside. */
  readonly fill?: boolean;
  /** Called once the leaving page has left, also under reduced motion. */
  readonly onExitComplete?: () => void;
  /**
   * The page. A leaving page keeps the content it last rendered, so render
   * routes for the location they were given, not the current one.
   */
  readonly children: ReactNode;
};

/**
 * Wraps route content so a page enters and leaves with motion when
 * `pageKey` changes. Under reduced motion the next page appears at once.
 */
export const PageTransition = ({
  pageKey,
  variant,
  waitForExit = false,
  fill = false,
  onExitComplete,
  children,
}: PageTransitionProps) => {
  const reduceMotion = useReducedMotion();
  const { initial, animate, exit } = reduceMotion ? still : variants[variant];

  return (
    <AnimatePresence
      mode={waitForExit ? "wait" : "sync"}
      {...(onExitComplete === undefined ? {} : { onExitComplete })}
    >
      <motion.div
        key={pageKey}
        initial={initial}
        animate={animate}
        exit={exit}
        className={stylex.props(fill && styles.fill).className}
      >
        {children}
      </motion.div>
    </AnimatePresence>
  );
};

const styles = stylex.create({
  fill: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    minHeight: 0,
  },
});

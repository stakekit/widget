import { motion, type TargetAndTransition } from "motion/react";
import type { ReactNode } from "react";

import { useReducedMotion } from "../components/use-reduced-motion";
import { entranceMotion, motionEasing } from "../tokens/motion-timing";

type EntranceStage = "first" | "later" | "still";

const stages = {
  // The Widget's first mount: waits for the frame to open, then drops in.
  first: {
    initial: { opacity: 0, y: -entranceMotion.firstRise },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        delay: entranceMotion.firstDelay,
        duration: entranceMotion.firstDuration,
        ease: motionEasing,
      },
    },
  },
  // Every later mount, such as returning to the page.
  later: {
    initial: { opacity: 0, y: -entranceMotion.laterRise },
    animate: {
      opacity: 1,
      y: 0,
      transition: {
        duration: entranceMotion.laterDuration,
        ease: motionEasing,
      },
    },
  },
  still: {
    initial: { opacity: 1, y: 0 },
    animate: { opacity: 1, y: 0, transition: { duration: 0 } },
  },
} as const satisfies Record<
  EntranceStage,
  {
    readonly initial: TargetAndTransition;
    readonly animate: TargetAndTransition;
  }
>;

/**
 * Content that drops into place as it mounts: slowly after the frame opens on
 * the Widget's `first` mount, briefly on `later` ones, and at once when
 * `still` or under reduced motion. The stage is read on mount.
 */
export const Entrance = ({
  stage,
  onEntered,
  children,
}: {
  readonly stage: EntranceStage;
  /** Called once the content is in place, also when it entered at once. */
  readonly onEntered?: () => void;
  readonly children: ReactNode;
}) => {
  const reduceMotion = useReducedMotion();
  const { initial, animate } = stages[reduceMotion ? "still" : stage];

  return (
    <motion.div
      initial={initial}
      animate={animate}
      {...(onEntered === undefined
        ? {}
        : { onAnimationComplete: () => onEntered() })}
    >
      {children}
    </motion.div>
  );
};

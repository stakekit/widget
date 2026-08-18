import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import type { PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import { useDisableTransitionDuration } from "../../../shared/react/layout-transition";
import {
  useMountAnimation,
  useMountRevealReady,
} from "../../mount-animation/index";
import { useHeaderHeight } from "../header/use-sync-header-height";
import { useCurrentLayout } from "./current-layout";
import { animationContainer } from "./layout.css";
import { usePoweredByHeight } from "./powered-by";

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [poweredByHeight] = usePoweredByHeight();

  const { state, dispatch } = useMountAnimation();

  const disableInitLayoutAnimation = useWidgetConfig(
    "disableInitLayoutAnimation"
  );

  const containerHeight =
    currentLayout.state?.height && headerHeight
      ? currentLayout.state.height + headerHeight + poweredByHeight
      : 0;

  const [disableTransitionDuration] = useDisableTransitionDuration();
  const revealReady = useMountRevealReady();

  const initialReveal =
    !state.layout && !disableTransitionDuration && !disableInitLayoutAnimation;

  const transition: MotionProps["transition"] = (() => {
    if (disableTransitionDuration) {
      return { duration: 0 };
    }
    if (state.layout) {
      return { duration: 0.3 };
    }
    if (disableInitLayoutAnimation) {
      return { duration: 0 };
    }
    // The gate replaces the fixed delay this transition used to carry.
    return { duration: 0.6 };
  })();
  const animate: TargetAndTransition = {
    height: initialReveal && !revealReady ? 0 : containerHeight,
    transition,
  };

  return (
    <motion.div
      data-rk="widget-container"
      layout="size"
      className={animationContainer}
      initial={{ height: 0 }}
      animate={animate}
      onAnimationComplete={(def: typeof animate) => {
        if (!def.height || def.height !== animate.height || state.layout) {
          return;
        }

        dispatch({ type: "layout" });
      }}
    >
      {children}
    </motion.div>
  );
};

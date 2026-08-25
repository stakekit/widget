import { useAtomValue } from "@effect/atom-react";
import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import type { PropsWithChildren } from "react";
import { useWidgetConfig } from "../../../features/widget-configuration/index";
import { useDisableTransitionDuration } from "../../../shared/react/layout-transition";
import {
  useMountAnimation,
  useMountRevealReady,
} from "../../mount-animation/index";
import { animationLayoutHeightAtom } from "../state/layout-height";
import { animationContainer } from "./layout.css";

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const containerHeight = useAtomValue(animationLayoutHeightAtom);

  const { state, dispatch } = useMountAnimation();

  const disableInitLayoutAnimation = useWidgetConfig(
    "disableInitLayoutAnimation"
  );

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

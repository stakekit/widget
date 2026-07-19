import { useAtom } from "@effect/atom-react";
import * as Atom from "effect/unstable/reactivity/Atom";
import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import type { PropsWithChildren } from "react";
import { useWidgetConfig } from "../../app/config/use-widget-config";
import { useMountAnimation } from "../mount-animation/react/use-mount-animation";
import { useCurrentLayout } from "./current-layout";
import { useHeaderHeight } from "./header/use-sync-header-height";
import { animationContainer } from "./layout.css";
import { usePoweredByHeight } from "./powered-by";

const disableTransitionDurationAtom = Atom.make(false);

export const useDisableTransitionDuration = () =>
  useAtom(disableTransitionDurationAtom);

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
    return { duration: 0.6, delay: 0.3 };
  })();
  const animate: TargetAndTransition = { height: containerHeight, transition };

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

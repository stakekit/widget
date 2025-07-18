import type { MotionProps, TargetAndTransition } from "motion/react";
import { motion } from "motion/react";
import { Just } from "purify-ts";
import type { PropsWithChildren } from "react";
import { useHeaderHeight } from "../../components/molecules/header/use-sync-header-height";
import { useFooterHeight } from "../../pages/components/footer-outlet/context";
import { useCurrentLayout } from "../../pages/components/layout/layout-context";
import { usePoweredByHeight } from "../../pages/components/powered-by";
import { useMountAnimation } from "../../providers/mount-animation";
import { useSettings } from "../../providers/settings";
import { animationContainer } from "../../style.css";
import createStateContext from "../../utils/create-state-context";

export const [useDisableTransitionDuration, DisableTransitionDurationProvider] =
  createStateContext(false);

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [footerHeight] = useFooterHeight();
  const [poweredByHeight] = usePoweredByHeight();

  const { state, dispatch } = useMountAnimation();

  const { disableInitLayoutAnimation } = useSettings();

  const containerHeight =
    currentLayout.state?.height && headerHeight
      ? currentLayout.state.height +
        headerHeight +
        footerHeight +
        poweredByHeight
      : 0;

  const [disableTransitionDuration] = useDisableTransitionDuration();

  const animate = Just(containerHeight)
    .chain<TargetAndTransition>((height) =>
      Just(null)
        .map<MotionProps["transition"]>(() => {
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
        })
        .map((transition) => ({ height, transition }))
    )
    .unsafeCoerce();

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

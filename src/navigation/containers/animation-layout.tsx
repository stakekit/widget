import type { MotionProps, TargetAndTransition } from "framer-motion";
import { motion } from "framer-motion";
import { animationContainer } from "../../style.css";
import { type PropsWithChildren } from "react";
import { useCurrentLayout } from "../../pages/components/layout/layout-context";
import { useHeaderHeight } from "../../components/molecules/header/use-sync-header-height";
import { useFooterHeight } from "../../pages/components/footer-outlet/context";
import { Box, Spinner } from "../../components";
import { useReferralCode } from "../../hooks/api/referral/use-referral-code";
import { useSettings } from "../../providers/settings";
import { useMountAnimation } from "../../providers/mount-animation";
import { usePoweredByHeight } from "../../pages/components/powered-by";
import createStateContext from "../../utils/create-state-context";
import { Just } from "purify-ts";

export const [useDisableTransitionDuration, DisableTransitionDurationProvider] =
  createStateContext(false);

export const AnimationLayout = ({ children }: PropsWithChildren) => {
  const currentLayout = useCurrentLayout();
  const [headerHeight] = useHeaderHeight();
  const [footerHeight] = useFooterHeight();
  const [poweredByHeight] = usePoweredByHeight();

  const { state, dispatch } = useMountAnimation();

  const { referralCheck, disableInitLayoutAnimation } = useSettings();
  const referralCode = useReferralCode();

  const showApp = !referralCheck || !!referralCode.data;

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
          } else if (state.layout) {
            return { duration: 0.3 };
          } else if (disableInitLayoutAnimation) {
            return { duration: 0 };
          }
          return { duration: 0.6, delay: 0.3 };
        })
        .map((transition) => ({ height, transition }))
    )
    .unsafeCoerce();

  return (
    <>
      {showApp ? (
        <motion.div
          data-rk="widget-container"
          layout="size"
          className={animationContainer}
          initial={{ height: 0 }}
          style={{ borderRadius: "20px", position: "relative" }}
          animate={animate}
          onAnimationComplete={(def: typeof animate) => {
            if (!def.height || state.layout) {
              return;
            }

            dispatch({ type: "layout" });
          }}
        >
          {children}
        </motion.div>
      ) : referralCode.isLoading ? (
        <Box display="flex" justifyContent="center" alignItems="center">
          <Spinner />
        </Box>
      ) : null}
    </>
  );
};
